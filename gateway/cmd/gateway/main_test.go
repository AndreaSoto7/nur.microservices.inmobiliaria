package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/config"
)

const testOrigin = "http://localhost:5173"

func newTestHandler() http.Handler {
	return newHandler(slog.New(slog.DiscardHandler), config.Config{
		RateLimitAuthPerMinute: 2,
		CORSOrigins:            []string{testOrigin},
	})
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

	newTestHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil))

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
