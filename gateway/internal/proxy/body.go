package proxy

import (
	"errors"
	"io"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/config"
)

const (
	authBodyLimit    = 64 << 10
	defaultBodyLimit = 1 << 20
)

func (h *Handler) bodyLimit(r *http.Request) int64 {
	switch {
	case config.IsAuthPath(r.URL.Path):
		return authBodyLimit
	case config.IsImageUpload(r.Method, r.URL.Path):
		return h.options.MaxImageBodyBytes
	default:
		return defaultBodyLimit
	}
}

// trackBody limita el body y recuerda sus errores de lectura. En auth, además, pone un deadline para
// recibirlo: dos clientes que nunca terminan de enviar bloquearían a identity, que atiende a pocos a
// la vez. net/http quita el deadline solo al llegar al final del body. Sin body no se pone (ServeHTTP
// ni llama a esta función): nadie lo quitaría, y al vencer cancelaría la request.
func (h *Handler) trackBody(w http.ResponseWriter, r *http.Request, limit int64) *trackedBody {
	if config.IsAuthPath(r.URL.Path) {
		// Sin soporte de deadlines queda el ReadTimeout del servidor, así que no es un error grave.
		_ = http.NewResponseController(w).SetReadDeadline(time.Now().Add(h.options.AuthReadTimeout))
	}
	return &trackedBody{ReadCloser: http.MaxBytesReader(w, r.Body, limit)}
}

// trackedBody recuerda si falló la lectura del body del cliente: el transporte reporta ese error igual
// que uno de la réplica, y sin esto no se podrían distinguir. Se lee desde la goroutine del transporte.
type trackedBody struct {
	io.ReadCloser
	err atomic.Pointer[error]
}

func (b *trackedBody) Read(data []byte) (int, error) {
	n, err := b.ReadCloser.Read(data)
	// Leer tras el cierre lo provoca el propio transporte cuando la réplica falla: no es del cliente.
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, http.ErrBodyReadAfterClose) {
		b.err.Store(&err)
	}
	return n, err
}

func (b *trackedBody) readError() error {
	if b == nil {
		return nil
	}
	if err := b.err.Load(); err != nil {
		return *err
	}
	return nil
}
