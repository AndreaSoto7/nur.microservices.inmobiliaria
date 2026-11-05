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
)

func TestHealthRespondsUp(t *testing.T) {
	rec := httptest.NewRecorder()

	newHandler(slog.New(slog.DiscardHandler)).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

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

	newHandler(slog.New(slog.DiscardHandler)).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil))

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

func TestServeStopsWhenContextIsCancelled(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- serve(ctx, listener, newHandler(slog.New(slog.DiscardHandler))) }()

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
