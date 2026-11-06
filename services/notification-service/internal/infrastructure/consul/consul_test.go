package consul

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

// fakeConsul verifica los PUT de registro y de baja.
type fakeConsul struct {
	mu         sync.Mutex
	registered []map[string]any
	removed    []string
	requests   []string
}

func (f *fakeConsul) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.requests = append(f.requests, r.Method+" "+r.URL.Path)
	switch r.URL.Path {
	case "/v1/agent/service/register":
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		f.registered = append(f.registered, body)
	default:
		f.removed = append(f.removed, r.URL.Path)
	}
}

func (f *fakeConsul) registrations() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.registered)
}

func newRegistrar(t *testing.T, fake *fakeConsul) *Registrar {
	t.Helper()
	server := httptest.NewServer(fake)
	t.Cleanup(server.Close)
	return NewRegistrar(server.URL, Service{
		ID: "notification-service-abc123", Name: "notification-service", Address: "10.0.0.5", Port: 8005,
	}, slog.New(slog.DiscardHandler))
}

func TestRegisterSendsTheCommonContract(t *testing.T) {
	fake := &fakeConsul{}

	if err := newRegistrar(t, fake).Register(context.Background()); err != nil {
		t.Fatalf("Register() error = %v", err)
	}

	if fake.requests[0] != "PUT /v1/agent/service/register" {
		t.Errorf("request = %s", fake.requests[0])
	}
	body := fake.registered[0]
	want := map[string]any{
		"ID": "notification-service-abc123", "Name": "notification-service", "Address": "10.0.0.5", "Port": float64(8005),
	}
	for key, value := range want {
		if body[key] != value {
			t.Errorf("%s = %v, want %v", key, body[key], value)
		}
	}
	check, _ := body["Check"].(map[string]any)
	wantCheck := map[string]any{
		"HTTP": "http://10.0.0.5:8005/health", "Interval": "10s", "Timeout": "2s", "DeregisterCriticalServiceAfter": "1m",
	}
	for key, value := range wantCheck {
		if check[key] != value {
			t.Errorf("Check.%s = %v, want %v", key, check[key], value)
		}
	}
}

func TestDeregisterUsesTheReplicaID(t *testing.T) {
	fake := &fakeConsul{}

	if err := newRegistrar(t, fake).Deregister(context.Background()); err != nil {
		t.Fatalf("Deregister() error = %v", err)
	}

	if want := "PUT /v1/agent/service/deregister/notification-service-abc123"; fake.requests[0] != want {
		t.Errorf("request = %s, want %s", fake.requests[0], want)
	}
}

// Consul en modo dev guarda todo en memoria: si se reinicia, el servicio debe volver a aparecer solo.
func TestRunRepeatsRegistrationAndStopsWithContext(t *testing.T) {
	fake := &fakeConsul{}
	registrar := newRegistrar(t, fake)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		registrar.Run(ctx, 5*time.Millisecond)
		close(done)
	}()

	deadline := time.After(5 * time.Second)
	for fake.registrations() < 3 {
		select {
		case <-deadline:
			t.Fatal("no repitió el registro")
		case <-time.After(time.Millisecond):
		}
	}
	cancel()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run no terminó al cancelar el contexto")
	}
}

// El registro no bloquea el arranque: si Consul no está, el servicio sigue y reintenta.
func TestRunSurvivesConsulBeingDown(t *testing.T) {
	server := httptest.NewServer(http.NotFoundHandler())
	url := server.URL
	server.Close()
	registrar := NewRegistrar(url, Service{ID: "x", Name: "x", Address: "10.0.0.5", Port: 1}, slog.New(slog.DiscardHandler))
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	registrar.Run(ctx, time.Millisecond)
}

func TestRegisterFailsOnErrorStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(server.Close)
	registrar := NewRegistrar(server.URL, Service{ID: "x", Name: "x", Address: "10.0.0.5", Port: 1}, slog.New(slog.DiscardHandler))

	if err := registrar.Register(context.Background()); err == nil {
		t.Error("Register() no devolvió error ante un 500")
	}
}

func TestContainerAddress(t *testing.T) {
	lookup := func(string) ([]string, error) { return []string{"fd00::1", "172.18.0.5"}, nil }
	failing := func(string) ([]string, error) { return nil, errors.New("no resuelve") }
	onlyLoopback := func(string) ([]string, error) { return []string{"127.0.0.1", "::1"}, nil }

	tests := []struct {
		name     string
		override string
		lookup   func(string) ([]string, error)
		want     string
		wantErr  bool
	}{
		{"usa la dirección indicada", "10.0.0.9", failing, "10.0.0.9", false},
		{"prefiere IPv4 del hostname", "", lookup, "172.18.0.5", false},
		{"falla si no resuelve", "", failing, "", true},
		{"nunca loopback: Consul no llegaría", "", onlyLoopback, "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ContainerAddress(tt.override, "abc123", tt.lookup)
			if (err != nil) != tt.wantErr {
				t.Fatalf("error = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("address = %q, want %q", got, tt.want)
			}
		})
	}
}
