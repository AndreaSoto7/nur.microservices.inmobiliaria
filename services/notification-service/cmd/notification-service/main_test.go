package main

import (
	"context"
	"net"
	"net/http"
	"sync"
	"testing"
	"time"
)

// Primero la baja y el consumidor, y recién después el HTTP: mientras Consul lo crea vivo, debe responder.
func TestServeRunsCleanupBeforeShuttingDownHTTP(t *testing.T) {
	var lc net.ListenConfig
	listener, err := lc.Listen(context.Background(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	url := "http://" + listener.Addr().String()
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	var mu sync.Mutex
	var answeredDuringCleanup bool
	cleanup := func() {
		resp, err := http.Get(url)
		if err == nil {
			_ = resp.Body.Close()
		}
		mu.Lock()
		defer mu.Unlock()
		answeredDuringCleanup = err == nil
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- serve(ctx, listener, handler, cleanup) }()

	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Errorf("serve() error = %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("serve() no terminó")
	}
	mu.Lock()
	defer mu.Unlock()
	if !answeredDuringCleanup {
		t.Error("el servidor ya no respondía durante la limpieza")
	}
}
