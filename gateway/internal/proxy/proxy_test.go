package proxy

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/discovery"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/middleware"
)

const (
	loginPath      = "/api/v1/auth/login"
	listPath       = "/api/v1/properties"
	uploadPath     = "/api/v1/properties/3f6c/images"
	upstreamWait   = 200 * time.Millisecond
	authReadWait   = 100 * time.Millisecond
	imageBodyLimit = 2 << 20
)

// spyPicker reparte en orden entre réplicas fijas y recuerda cuáles se marcaron como caídas.
type spyPicker struct {
	mu       sync.Mutex
	replicas map[string][]discovery.Instance
	next     map[string]int
	marked   []string
}

func newSpyPicker(replicas map[string][]discovery.Instance) *spyPicker {
	return &spyPicker{replicas: replicas, next: map[string]int{}}
}

func (s *spyPicker) Pick(service string) (discovery.Instance, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	candidates := s.replicas[service]
	if len(candidates) == 0 {
		return discovery.Instance{}, false
	}
	instance := candidates[s.next[service]%len(candidates)]
	s.next[service]++
	return instance, true
}

func (s *spyPicker) MarkDown(instance discovery.Instance) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.marked = append(s.marked, instance.Address)
}

func (s *spyPicker) markedAddresses() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.marked)
}

func instanceOf(server *httptest.Server) discovery.Instance {
	return discovery.Instance{Address: strings.TrimPrefix(server.URL, "http://")}
}

func newBackend(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return server
}

// newGateway levanta un servidor real: los deadlines, el chunked y las cancelaciones solo se comportan
// de verdad sobre una conexión TCP.
func newGateway(t *testing.T, picker Picker) *httptest.Server {
	t.Helper()
	handler := New(picker, Options{
		UpstreamTimeout:   upstreamWait,
		AuthReadTimeout:   authReadWait,
		MaxImageBodyBytes: imageBodyLimit,
	}, slog.New(slog.DiscardHandler))
	server := httptest.NewServer(middleware.Routing(handler))
	t.Cleanup(server.Close)
	return server
}

func gatewayTo(t *testing.T, services map[string]*httptest.Server) (*httptest.Server, *spyPicker) {
	t.Helper()
	replicas := map[string][]discovery.Instance{}
	for name, server := range services {
		replicas[name] = []discovery.Instance{instanceOf(server)}
	}
	picker := newSpyPicker(replicas)
	return newGateway(t, picker), picker
}

func problemCode(t *testing.T, resp *http.Response) string {
	t.Helper()
	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("body no es JSON: %v", err)
	}
	code, _ := body["code"].(string)
	return code
}

func assertProblem(t *testing.T, resp *http.Response, status int, code string) {
	t.Helper()
	if resp.StatusCode != status {
		t.Errorf("status = %d, want %d", resp.StatusCode, status)
	}
	if got := problemCode(t, resp); got != code {
		t.Errorf("code = %q, want %q", got, code)
	}
}

func TestRoutesEachPrefixToItsService(t *testing.T) {
	backend := func(name string) *httptest.Server {
		return newBackend(t, func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(name))
		})
	}
	gateway, _ := gatewayTo(t, map[string]*httptest.Server{
		"identity-service": backend("identity"),
		"listing-service":  backend("listing"),
		"visit-service":    backend("visit"),
	})

	tests := []struct{ path, want string }{
		{"/api/v1/users/me", "identity"},
		{"/api/v1/properties", "listing"},
		{"/api/v1/catalog/properties", "listing"},
		{"/api/v1/favorites", "listing"},
		{"/api/v1/visits", "visit"},
		{"/api/v1/leads", "visit"},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			resp, err := http.Get(gateway.URL + tt.path)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)
			if string(body) != tt.want {
				t.Errorf("atendió %q, want %q", body, tt.want)
			}
		})
	}
}

func TestForwardsPathAndQueryUntouched(t *testing.T) {
	var gotPath, gotRawPath, gotQuery string
	backend := newBackend(t, func(_ http.ResponseWriter, r *http.Request) {
		gotPath, gotRawPath, gotQuery = r.URL.Path, r.URL.RawPath, r.URL.RawQuery
	})
	gateway, _ := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	resp, err := http.Get(gateway.URL + "/api/v1/catalog/properties?zone=equipetrol&features=GARAGE,POOL&sort=price,asc")
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()

	if gotPath != "/api/v1/catalog/properties" || gotRawPath != "" {
		t.Errorf("path = %q, raw = %q", gotPath, gotRawPath)
	}
	if gotQuery != "zone=equipetrol&features=GARAGE,POOL&sort=price,asc" {
		t.Errorf("query = %q", gotQuery)
	}
}

func TestRoundRobinAcrossReplicas(t *testing.T) {
	var servers []*httptest.Server
	for i := range 3 {
		servers = append(servers, newBackend(t, func(w http.ResponseWriter, _ *http.Request) {
			fmt.Fprint(w, i)
		}))
	}
	replicas := make([]discovery.Instance, 0, len(servers))
	for _, server := range servers {
		replicas = append(replicas, instanceOf(server))
	}
	gateway := newGateway(t, newSpyPicker(map[string][]discovery.Instance{"listing-service": replicas}))

	var got []string
	for range 6 {
		resp, err := http.Get(gateway.URL + listPath)
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		got = append(got, string(body))
	}

	if want := []string{"0", "1", "2", "0", "1", "2"}; !slices.Equal(got, want) {
		t.Errorf("orden = %v, want %v", got, want)
	}
}

func TestNoReplicasResponds503(t *testing.T) {
	gateway := newGateway(t, newSpyPicker(nil))

	resp, err := http.Get(gateway.URL + listPath)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	assertProblem(t, resp, http.StatusServiceUnavailable, "GATEWAY_NO_HEALTHY_INSTANCE")
}

func TestConnectionFailureMarksReplicaAndHidesAddress(t *testing.T) {
	closed := httptest.NewServer(http.NotFoundHandler())
	address := instanceOf(closed).Address
	closed.Close()
	picker := newSpyPicker(map[string][]discovery.Instance{"listing-service": {{Address: address}}})
	gateway := newGateway(t, picker)

	resp, err := http.Get(gateway.URL + listPath)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusBadGateway {
		t.Errorf("status = %d", resp.StatusCode)
	}
	if !strings.Contains(string(body), "GATEWAY_UPSTREAM_ERROR") {
		t.Errorf("body = %s", body)
	}
	if strings.Contains(string(body), address) {
		t.Errorf("el body expone la dirección interna: %s", body)
	}
	if got := picker.markedAddresses(); !slices.Equal(got, []string{address}) {
		t.Errorf("marcadas = %v", got)
	}
}

func TestReplicaCuttingTheConnectionIsMarked(t *testing.T) {
	backend := newBackend(t, func(w http.ResponseWriter, _ *http.Request) {
		conn, _, err := w.(http.Hijacker).Hijack()
		if err == nil {
			_ = conn.Close()
		}
	})
	gateway, picker := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	resp, err := http.Post(gateway.URL+listPath, "application/json", strings.NewReader("{}"))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	assertProblem(t, resp, http.StatusBadGateway, "GATEWAY_UPSTREAM_ERROR")
	if got := picker.markedAddresses(); len(got) != 1 {
		t.Errorf("marcadas = %v", got)
	}
}

func TestSlowReplicaRespondsTimeoutAndIsMarked(t *testing.T) {
	release := make(chan struct{})
	backend := newBackend(t, func(http.ResponseWriter, *http.Request) { <-release })
	t.Cleanup(func() { close(release) })
	gateway, picker := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	resp, err := http.Get(gateway.URL + listPath)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	assertProblem(t, resp, http.StatusGatewayTimeout, "GATEWAY_UPSTREAM_TIMEOUT")
	if got := picker.markedAddresses(); len(got) != 1 {
		t.Errorf("marcadas = %v", got)
	}
}

// Reintentar un POST en otra réplica podría duplicar sus efectos.
func TestFailedPostIsNotRetried(t *testing.T) {
	var hits atomic.Int64
	backend := func() *httptest.Server {
		return newBackend(t, func(w http.ResponseWriter, _ *http.Request) {
			hits.Add(1)
			conn, _, err := w.(http.Hijacker).Hijack()
			if err == nil {
				_ = conn.Close()
			}
		})
	}
	picker := newSpyPicker(map[string][]discovery.Instance{
		"listing-service": {instanceOf(backend()), instanceOf(backend())},
	})
	gateway := newGateway(t, picker)

	resp, err := http.Post(gateway.URL+listPath, "application/json", strings.NewReader("{}"))
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()

	if got := hits.Load(); got != 1 {
		t.Errorf("la request llegó %d veces, want 1", got)
	}
}

func TestBusinessServerErrorPassesThroughWithoutMarking(t *testing.T) {
	backend := newBackend(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"code":"INTERNAL_ERROR"}`))
	})
	gateway, picker := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	resp, err := http.Get(gateway.URL + listPath)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	assertProblem(t, resp, http.StatusInternalServerError, "INTERNAL_ERROR")
	if got := picker.markedAddresses(); len(got) != 0 {
		t.Errorf("marcadas = %v", got)
	}
}

// Si marcara, cerrar una pestaña en pleno login dejaría a identity en 503 para todos.
func TestClientCancellingDoesNotMarkReplica(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	backend := newBackend(t, func(http.ResponseWriter, *http.Request) {
		close(started)
		<-release
	})
	t.Cleanup(func() { close(release) })
	gateway, picker := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	ctx, cancel := context.WithCancel(context.Background())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, gateway.URL+listPath, nil)
	if err != nil {
		t.Fatal(err)
	}
	errs := make(chan error, 1)
	go func() {
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			_ = resp.Body.Close()
		}
		errs <- err
	}()
	<-started
	cancel()
	<-errs
	time.Sleep(50 * time.Millisecond)

	if got := picker.markedAddresses(); len(got) != 0 {
		t.Errorf("marcadas = %v", got)
	}
}

func rawRequest(t *testing.T, gateway *httptest.Server, request string) *http.Response {
	t.Helper()
	conn, err := net.Dial("tcp", strings.TrimPrefix(gateway.URL, "http://"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if _, err := io.WriteString(conn, request); err != nil {
		t.Fatal(err)
	}
	if err := conn.SetReadDeadline(time.Now().Add(5 * time.Second)); err != nil {
		t.Fatal(err)
	}
	resp, err := http.ReadResponse(bufio.NewReader(conn), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = resp.Body.Close() })
	return resp
}

func TestForwardedHeadersComeFromTheConnection(t *testing.T) {
	var forwarded string
	backend := newBackend(t, func(_ http.ResponseWriter, r *http.Request) {
		forwarded = r.Header.Get("X-Forwarded-For")
	})
	gateway, _ := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	req, err := http.NewRequest(http.MethodGet, gateway.URL+listPath, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("X-Forwarded-For", "203.0.113.9")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()

	if forwarded != "127.0.0.1" {
		t.Errorf("X-Forwarded-For = %q, want la IP real de la conexión", forwarded)
	}
}

// Un Upgrade: h2c abre un túnel hacia el servicio: lo que viaje por él ya no pasa por el gateway.
func TestUpgradeIsNotForwarded(t *testing.T) {
	var upgrade, connection string
	backend := newBackend(t, func(_ http.ResponseWriter, r *http.Request) {
		upgrade, connection = r.Header.Get("Upgrade"), r.Header.Get("Connection")
	})
	gateway, _ := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	resp := rawRequest(t, gateway, "GET "+listPath+" HTTP/1.1\r\nHost: x\r\n"+
		"Connection: Upgrade, HTTP2-Settings\r\nUpgrade: h2c\r\nHTTP2-Settings: AAMAAABkAAQAAP__\r\n\r\n")

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d", resp.StatusCode)
	}
	if upgrade != "" || strings.Contains(strings.ToLower(connection), "upgrade") {
		t.Errorf("Upgrade = %q, Connection = %q", upgrade, connection)
	}
}

// Los trailers son headers que llegan después del body: un X-User-Id por ahí esquivaría el borrado.
// ReverseProxy clona la request antes de que lleguen, así que no pasan. Este test cuida que siga así.
func TestRequestTrailersAreNotForwarded(t *testing.T) {
	var trailer http.Header
	backend := newBackend(t, func(_ http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		trailer = r.Trailer.Clone()
	})
	gateway, _ := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	resp := rawRequest(t, gateway, "POST "+listPath+" HTTP/1.1\r\nHost: x\r\n"+
		"Transfer-Encoding: chunked\r\nTrailer: X-User-Id\r\n\r\n2\r\n{}\r\n0\r\nX-User-Id: falso\r\n\r\n")

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d", resp.StatusCode)
	}
	if got := trailer.Get("X-User-Id"); got != "" {
		t.Errorf("el trailer llegó al servicio: %q", got)
	}
}

// El gateway es dueño de estos headers: copiarlos del servicio los duplicaría, y el navegador rechaza
// un Access-Control-Allow-Origin repetido.
func TestReplicaHeadersOwnedByGatewayAreRemoved(t *testing.T) {
	backend := newBackend(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("X-Correlation-Id", "del-servicio")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("X-Propio", "se-queda")
		w.Header().Set("Server", "gunicorn")
		w.Header().Set("X-Powered-By", "Express")
	})
	gateway, _ := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	resp, err := http.Get(gateway.URL + listPath)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	for _, header := range []string{"X-Correlation-Id", "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials", "Server", "X-Powered-By"} {
		if got := resp.Header.Values(header); len(got) != 0 {
			t.Errorf("%s = %v", header, got)
		}
	}
	if got := resp.Header.Get("X-Propio"); got != "se-queda" {
		t.Errorf("X-Propio = %q", got)
	}
}

func TestLogsWhichReplicaServedTheRequest(t *testing.T) {
	backend := newBackend(t, func(http.ResponseWriter, *http.Request) {})
	picker := newSpyPicker(map[string][]discovery.Instance{"listing-service": {instanceOf(backend)}})
	handler := New(picker, Options{UpstreamTimeout: upstreamWait, AuthReadTimeout: authReadWait, MaxImageBodyBytes: imageBodyLimit},
		slog.New(slog.DiscardHandler))
	var log strings.Builder
	logger := slog.New(slog.NewJSONHandler(&log, nil))
	gateway := httptest.NewServer(middleware.Logging(logger)(middleware.Routing(handler)))
	t.Cleanup(gateway.Close)

	resp, err := http.Get(gateway.URL + listPath)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	gateway.Close()

	if !strings.Contains(log.String(), instanceOf(backend).Address) {
		t.Errorf("el log no nombra la réplica: %s", log.String())
	}
}

// ReverseProxy rechaza este Upgrade antes de tocar la red, con un error que parece de transporte: si
// marcara, una request anónima repetida dejaría sin réplicas a cualquier servicio.
func TestInvalidUpgradeDoesNotMarkReplica(t *testing.T) {
	backend := newBackend(t, func(http.ResponseWriter, *http.Request) {})
	gateway, picker := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	resp := rawRequest(t, gateway, "GET "+listPath+" HTTP/1.1\r\nHost: x\r\n"+
		"Connection: Upgrade\r\nUpgrade: \xc3\xa9\r\n\r\n")

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d", resp.StatusCode)
	}
	if got := picker.markedAddresses(); len(got) != 0 {
		t.Errorf("marcadas = %v: un cliente sacó una réplica sana", got)
	}
}

// Solo se marca ante errores de red. Cualquier otro error no se sabe de quién es, y marcar de más es
// peor: Consul igual detecta una réplica caída, pero nadie repara una réplica sana sacada por un cliente.
func TestOnlyNetworkErrorsMarkReplica(t *testing.T) {
	tests := []struct {
		name  string
		err   error
		marks bool
	}{
		{"conexión cerrada", io.EOF, true},
		{"conexión cortada a medias", io.ErrUnexpectedEOF, true},
		{"timeout", context.DeadlineExceeded, true},
		{"dial", &net.OpError{Op: "dial", Err: errors.New("connection refused")}, true},
		{"desconocido", errors.New("client tried to switch to invalid protocol"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			picker := newSpyPicker(nil)
			handler := New(picker, Options{}, slog.New(slog.DiscardHandler))
			state := &requestState{instance: discovery.Instance{Address: "10.0.0.5:8002"}}
			req := httptest.NewRequest(http.MethodGet, listPath, nil)
			req = req.WithContext(context.WithValue(req.Context(), stateKey{}, state))
			rec := httptest.NewRecorder()

			handler.handleError(rec, req, tt.err)

			if got := len(picker.markedAddresses()) == 1; got != tt.marks {
				t.Errorf("marcó = %v, want %v", got, tt.marks)
			}
			if rec.Code < http.StatusBadGateway {
				t.Errorf("status = %d", rec.Code)
			}
		})
	}
}

// El Host que recibe el servicio es la IP de la réplica: un Location absoluto la expondría.
func TestLocationNeverExposesTheReplica(t *testing.T) {
	var address string
	tests := []struct {
		name     string
		location func() string
		want     string
	}{
		{"absoluto hacia la réplica", func() string { return "http://" + address + "/api/v1/properties/3f6c?a=1" }, "/api/v1/properties/3f6c?a=1"},
		{"relativo", func() string { return "/api/v1/properties/3f6c" }, "/api/v1/properties/3f6c"},
		{"a otro sitio", func() string { return "https://example.com/x" }, "https://example.com/x"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			backend := newBackend(t, func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Location", tt.location())
				w.WriteHeader(http.StatusCreated)
			})
			address = instanceOf(backend).Address
			gateway, _ := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

			resp, err := http.Post(gateway.URL+listPath, "application/json", strings.NewReader("{}"))
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()

			if got := resp.Header.Get("Location"); got != tt.want {
				t.Errorf("Location = %q, want %q", got, tt.want)
			}
		})
	}
}

// Ningún servicio lo usa, y es el Host que mandó el cliente: si alguno lo activara, serviría para
// envenenar enlaces.
func TestForwardedHostIsNotForwarded(t *testing.T) {
	var host string
	var present bool
	backend := newBackend(t, func(_ http.ResponseWriter, r *http.Request) {
		_, present = r.Header["X-Forwarded-Host"]
		host = r.Header.Get("X-Forwarded-Host")
	})
	gateway, _ := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	resp := rawRequest(t, gateway, "GET "+listPath+" HTTP/1.1\r\nHost: malicioso.example\r\n\r\n")

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d", resp.StatusCode)
	}
	if present {
		t.Errorf("X-Forwarded-Host = %q", host)
	}
}
