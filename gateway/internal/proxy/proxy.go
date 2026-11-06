// Package proxy reenvía cada request a una réplica sana (patrón Proxy): el cliente no sabe cuántas
// hay ni dónde están.
package proxy

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/discovery"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/middleware"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/problem"
)

const (
	dialTimeout         = 3 * time.Second
	keepAlive           = 30 * time.Second
	idleConnTimeout     = 90 * time.Second
	maxIdleConns        = 100
	maxIdleConnsPerHost = 20

	// statusClientClosed no llega a nadie, porque el cliente ya se fue: solo se ve en el log.
	statusClientClosed = 499
)

// Picker elige la réplica y recibe el aviso de que falló. Lo implementa balancer.Balancer.
type Picker interface {
	Pick(service string) (discovery.Instance, bool)
	MarkDown(instance discovery.Instance)
}

// Options son los límites del proxy.
type Options struct {
	UpstreamTimeout   time.Duration
	AuthReadTimeout   time.Duration
	MaxImageBodyBytes int64
}

// Handler es el último eslabón de la cadena.
type Handler struct {
	picker  Picker
	options Options
	logger  *slog.Logger
	reverse *httputil.ReverseProxy
}

type stateKey struct{}

// requestState viaja en el contexto: Rewrite no puede responder, así que la réplica se elige antes,
// y ErrorHandler necesita saber a cuál marcar.
type requestState struct {
	instance discovery.Instance
}

// New arma el proxy.
func New(picker Picker, options Options, logger *slog.Logger) *Handler {
	handler := &Handler{picker: picker, options: options, logger: logger}
	handler.reverse = &httputil.ReverseProxy{
		Rewrite:        rewrite,
		Transport:      newTransport(options.UpstreamTimeout),
		ModifyResponse: cleanResponse,
		ErrorHandler:   handler.handleError,
		ErrorLog:       slog.NewLogLogger(logger.Handler(), slog.LevelWarn),
	}
	return handler
}

func newTransport(upstreamTimeout time.Duration) *http.Transport {
	dialer := &net.Dialer{Timeout: dialTimeout, KeepAlive: keepAlive}
	return &http.Transport{
		DialContext:           dialer.DialContext,
		ResponseHeaderTimeout: upstreamTimeout,
		IdleConnTimeout:       idleConnTimeout,
		MaxIdleConns:          maxIdleConns,
		MaxIdleConnsPerHost:   maxIdleConnsPerHost,
		// El body se reenvía tal cual: que el cliente y el servicio negocien la compresión.
		DisableCompression: true,
	}
}

// ServeHTTP elige la réplica antes de reenviar: el 503 no se puede responder desde Rewrite.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	route, ok := middleware.RouteFrom(r.Context())
	if !ok {
		problem.Write(w, r, problem.RouteNotFound)
		return
	}
	instance, ok := h.picker.Pick(route.Service)
	if !ok {
		problem.Write(w, r, problem.NoHealthyInstance)
		return
	}
	middleware.SetUpstream(r.Context(), instance.Address)

	// Un Upgrade: h2c abriría un túnel hacia el servicio, y lo que viaje por él ya no pasa por aquí. Se
	// borra antes de ReverseProxy, que además responde con un error propio si el valor es inválido.
	r.Header.Del("Upgrade")

	state := &requestState{instance: instance}
	r = r.WithContext(context.WithValue(r.Context(), stateKey{}, state))
	h.reverse.ServeHTTP(w, r)
}

// rewrite reenvía el path sin reescribirlo. SetURL cambia el Host por el de la réplica: identity lo
// admite porque su ALLOWED_HOSTS incluye la IP del contenedor.
func rewrite(pr *httputil.ProxyRequest) {
	state, _ := pr.In.Context().Value(stateKey{}).(*requestState)
	pr.SetURL(&url.URL{Scheme: "http", Host: state.instance.Address})
	pr.SetXForwarded()
	// Es el Host que mandó el cliente, y ningún servicio lo usa: si alguno lo activara, serviría para
	// envenenar enlaces.
	pr.Out.Header.Del("X-Forwarded-Host")
}

// cleanResponse quita lo que no debe llegar tal cual al cliente. La cadena ya escribió el correlation-id
// y los headers de CORS: net/http los sumaría en vez de reemplazarlos, y el navegador rechaza un
// Access-Control-Allow-Origin repetido. Server y X-Powered-By solo revelan la tecnología del servicio.
func cleanResponse(resp *http.Response) error {
	for _, header := range []string{problem.CorrelationHeader, "Server", "X-Powered-By"} {
		resp.Header.Del(header)
	}
	for key := range resp.Header {
		if strings.HasPrefix(key, "Access-Control-") {
			delete(resp.Header, key)
		}
	}
	hideReplicaInLocation(resp)
	return nil
}

// hideReplicaInLocation vuelve relativo un Location absoluto: el Host que recibe el servicio es la IP de
// la réplica, y el cliente no podría seguir ese enlace.
func hideReplicaInLocation(resp *http.Response) {
	location, err := url.Parse(resp.Header.Get("Location"))
	if err != nil || resp.Request == nil || location.Host != resp.Request.URL.Host {
		return
	}
	location.Scheme, location.Host = "", ""
	if location.Path == "" {
		location.Path = "/"
	}
	resp.Header.Set("Location", location.String())
}

// handleError marca la réplica solo si la culpa es suya. Si no, cualquier cliente podría sacar réplicas
// de servicio: bastaría con cerrar una pestaña. El detalle del error tiene
// direcciones internas, así que va solo al log.
func (h *Handler) handleError(w http.ResponseWriter, r *http.Request, err error) {
	state, _ := r.Context().Value(stateKey{}).(*requestState)
	if r.Context().Err() != nil {
		w.WriteHeader(statusClientClosed)
		return
	}
	h.reportUpstreamFailure(w, r, state.instance, err)
}

// reportUpstreamFailure marca solo los errores de red. Ante cualquier otro no se sabe de quién es la
// culpa, y marcar de más es peor: Consul igual detecta una réplica caída, pero nadie repara una réplica
// sana que sacó un cliente.
func (h *Handler) reportUpstreamFailure(w http.ResponseWriter, r *http.Request, instance discovery.Instance, err error) {
	if isNetworkFailure(err) {
		h.picker.MarkDown(instance)
	}
	h.logger.Warn("falló el reenvío a la réplica",
		"upstream", instance.Address,
		"error", err,
		"correlationId", w.Header().Get(problem.CorrelationHeader))
	if isTimeout(err) {
		problem.Write(w, r, problem.UpstreamTimeout)
		return
	}
	problem.Write(w, r, problem.UpstreamError)
}

func isNetworkFailure(err error) bool {
	var netErr net.Error
	return errors.As(err, &netErr) || errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF)
}

func isTimeout(err error) bool {
	var netErr net.Error
	return errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &netErr) && netErr.Timeout())
}
