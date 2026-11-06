package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/auth"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/config"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/discovery"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/proxy"
)

const testOrigin = "http://localhost:5173"

func newTestHandler() http.Handler {
	return newHandler(slog.New(slog.DiscardHandler), config.Config{
		RateLimitAuthPerMinute: 2,
		CORSOrigins:            []string{testOrigin},
	}, rejectAllTokens{}, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
}

type rejectAllTokens struct{}

func (rejectAllTokens) Validate(context.Context, string) error {
	return auth.ErrInvalidToken
}

type acceptAllTokens struct{}

func (acceptAllTokens) Validate(context.Context, string) error { return nil }

type fixedPicker struct{ instance discovery.Instance }

func (f fixedPicker) Pick(string) (discovery.Instance, bool) { return f.instance, true }
func (fixedPicker) MarkDown(discovery.Instance)              {}

// La cadena completa contra un servicio falso: lo que cada eslabón promete, visto desde afuera.
func TestFullChainAgainstAFakeService(t *testing.T) {
	var received http.Header
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received = r.Header.Clone()
		w.Header().Set("X-Correlation-Id", "del-servicio")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusCreated)
	}))
	t.Cleanup(backend.Close)
	logger := slog.New(slog.DiscardHandler)
	upstream := proxy.New(fixedPicker{discovery.Instance{Address: strings.TrimPrefix(backend.URL, "http://")}}, proxy.Options{
		UpstreamTimeout:   time.Second,
		AuthReadTimeout:   time.Second,
		MaxImageBodyBytes: 1 << 20,
	}, logger)
	gateway := httptest.NewServer(newHandler(logger, config.Config{
		RateLimitAuthPerMinute: 2,
		CORSOrigins:            []string{testOrigin},
	}, acceptAllTokens{}, upstream))
	t.Cleanup(gateway.Close)

	req, err := http.NewRequest(http.MethodPost, gateway.URL+"/api/v1/properties", strings.NewReader("{}"))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer abc.def.ghi")
	req.Header.Set("X-User-Id", "falso")
	req.Header.Set("Origin", testOrigin)
	req.Header.Set("X-Correlation-Id", "abc-123")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("status = %d", resp.StatusCode)
	}
	if got := received.Get("Authorization"); got != "Bearer abc.def.ghi" {
		t.Errorf("Authorization = %q: debe llegar intacto", got)
	}
	if got := received.Get("X-User-Id"); got != "" {
		t.Errorf("X-User-Id llegó al servicio: %q", got)
	}
	if got := received.Get("X-Correlation-Id"); got != "abc-123" {
		t.Errorf("correlation-id reenviado = %q", got)
	}
	if got := resp.Header.Values("X-Correlation-Id"); len(got) != 1 || got[0] != "abc-123" {
		t.Errorf("correlation-id devuelto = %v", got)
	}
	if got := resp.Header.Values("Access-Control-Allow-Origin"); len(got) != 1 || got[0] != testOrigin {
		t.Errorf("Allow-Origin = %v", got)
	}
}

func TestProtectedRouteRequiresToken(t *testing.T) {
	rec := httptest.NewRecorder()

	newTestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil))

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d", rec.Code)
	}
}

func TestPublicRouteDoesNotRequireToken(t *testing.T) {
	rec := httptest.NewRecorder()

	newTestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/catalog/properties", nil))

	if rec.Code == http.StatusUnauthorized {
		t.Error("una ruta pública exigió token")
	}
}

func TestHealthRespondsUp(t *testing.T) {
	rec := httptest.NewRecorder()

	newTestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body no es JSON: %v", err)
	}
	if body["status"] != "UP" {
		t.Errorf("status = %q", body["status"])
	}
}

func TestUnknownPathRespondsNotFoundProblem(t *testing.T) {
	rec := httptest.NewRecorder()

	newTestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/otra-cosa", nil))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/problem+json" {
		t.Errorf("Content-Type = %q", got)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if id, _ := body["correlationId"].(string); id == "" || id != rec.Header().Get("X-Correlation-Id") {
		t.Errorf("correlationId = %q, header = %q", id, rec.Header().Get("X-Correlation-Id"))
	}
}

func TestLoginIsRateLimitedThroughTheChain(t *testing.T) {
	handler := newTestHandler()
	login := func() *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil))
		return rec
	}
	login()
	login()

	rec := login()

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if id, _ := body["correlationId"].(string); id == "" {
		t.Error("el 429 no lleva correlationId: el rate limit quedó antes del correlation-id")
	}
}

// Si una variante del path llegara al servicio sin contar, el rate limit no serviría.
func TestLoginPathVariantsCannotEvadeRateLimit(t *testing.T) {
	tests := []struct {
		name, target string
		status       int
	}{
		{"barra final", "/api/v1/auth/login/", http.StatusBadRequest},
		{"doble barra", "/api/v1/auth//login", http.StatusBadRequest},
		{"punto", "/api/v1/auth/./login", http.StatusBadRequest},
		{"barra final codificada", "/api/v1/auth/login%2F", http.StatusBadRequest},
		{"punto y coma", "/api/v1/auth/login;x", http.StatusBadRequest},
		{"letra codificada cuenta como login", "/api/v1/auth/%6cogin", http.StatusTooManyRequests},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := newTestHandler()
			for range 2 {
				handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil))
			}
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, tt.target, nil))

			if rec.Code != tt.status {
				t.Errorf("status = %d, want %d", rec.Code, tt.status)
			}
		})
	}
}

func TestPreflightIsAnsweredThroughTheChain(t *testing.T) {
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
	req.Header.Set("Origin", testOrigin)
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	rec := httptest.NewRecorder()

	newTestHandler().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != testOrigin {
		t.Errorf("Allow-Origin = %q", got)
	}
}

// El frontend solo puede leer un 429 si lleva Allow-Origin: CORS debe ir antes del rate limit.
func TestRateLimitedResponseCarriesCORSHeaders(t *testing.T) {
	handler := newTestHandler()
	var rec *httptest.ResponseRecorder
	for range 3 {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
		req.Header.Set("Origin", testOrigin)
		rec = httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
	}

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != testOrigin {
		t.Errorf("Allow-Origin = %q", got)
	}
}

func TestServeStopsWhenContextIsCancelled(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- serve(ctx, listener, newTestHandler()) }()

	url := "http://" + listener.Addr().String() + "/health"
	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("el servidor no responde: %v", err)
	}
	_ = resp.Body.Close()

	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Errorf("serve() error = %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("serve() no terminó tras cancelar el contexto")
	}
}
