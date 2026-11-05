package discovery

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type consulEntry struct {
	Node    consulNode    `json:"Node"`
	Service consulService `json:"Service"`
}

// fakeConsul responde como GET /v1/health/service/<nombre>?passing=true.
type fakeConsul struct {
	mu       sync.Mutex
	entries  map[string][]consulEntry
	status   int
	requests []string
}

func (f *fakeConsul) set(service string, instances ...consulEntry) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.entries == nil {
		f.entries = map[string][]consulEntry{}
	}
	f.entries[service] = instances
}

func (f *fakeConsul) setStatus(status int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.status = status
}

func (f *fakeConsul) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.requests = append(f.requests, r.Method+" "+r.URL.RequestURI())
	if f.status != 0 {
		w.WriteHeader(f.status)
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/v1/health/service/")
	entries := f.entries[name]
	if entries == nil {
		entries = []consulEntry{}
	}
	_ = json.NewEncoder(w).Encode(entries)
}

func entry(address string, port int) consulEntry {
	return consulEntry{Service: consulService{Address: address, Port: port}}
}

func newTestClient(t *testing.T, fake *fakeConsul, services ...string) *Client {
	t.Helper()
	server := httptest.NewServer(fake)
	t.Cleanup(server.Close)
	return NewClient(server.URL, services, slog.New(slog.DiscardHandler))
}

func addresses(instances []Instance) []string {
	result := make([]string, 0, len(instances))
	for _, instance := range instances {
		result = append(result, instance.Address)
	}
	return result
}

func TestRefreshAsksConsulOnlyForPassingInstances(t *testing.T) {
	fake := &fakeConsul{}
	client := newTestClient(t, fake, "listing-service", "identity-service")

	client.Refresh(context.Background())

	want := []string{
		"GET /v1/health/service/listing-service?passing=true",
		"GET /v1/health/service/identity-service?passing=true",
	}
	if !slices.Equal(fake.requests, want) {
		t.Errorf("requests = %v", fake.requests)
	}
}

func TestInstancesReturnsAddressAndPort(t *testing.T) {
	fake := &fakeConsul{}
	fake.set("listing-service", entry("10.0.0.5", 8002))
	client := newTestClient(t, fake, "listing-service")

	client.Refresh(context.Background())

	got := client.Instances("listing-service")
	if len(got) != 1 || got[0].Address != "10.0.0.5:8002" {
		t.Errorf("Instances = %v", got)
	}
}

// El round robin solo reparte en orden si la lista no cambia de orden entre consultas.
func TestInstancesAreSortedSoRoundRobinIsStable(t *testing.T) {
	fake := &fakeConsul{}
	fake.set("listing-service", entry("10.0.0.7", 8002), entry("10.0.0.5", 8002), entry("10.0.0.6", 8002))
	client := newTestClient(t, fake, "listing-service")

	client.Refresh(context.Background())

	want := []string{"10.0.0.5:8002", "10.0.0.6:8002", "10.0.0.7:8002"}
	if got := addresses(client.Instances("listing-service")); !slices.Equal(got, want) {
		t.Errorf("Instances = %v", got)
	}
}

// Consul documenta que Service.Address puede venir vacío: entonces vale la dirección del nodo.
func TestInstanceFallsBackToNodeAddress(t *testing.T) {
	fake := &fakeConsul{}
	fake.set("listing-service", consulEntry{
		Node:    consulNode{Address: "10.0.0.9"},
		Service: consulService{Port: 8002},
	})
	client := newTestClient(t, fake, "listing-service")

	client.Refresh(context.Background())

	if got := addresses(client.Instances("listing-service")); !slices.Equal(got, []string{"10.0.0.9:8002"}) {
		t.Errorf("Instances = %v", got)
	}
}

func TestInstanceWithoutAddressOrPortIsIgnored(t *testing.T) {
	fake := &fakeConsul{}
	fake.set("listing-service", entry("", 8002), entry("10.0.0.5", 0), entry("10.0.0.6", 8002))
	client := newTestClient(t, fake, "listing-service")

	client.Refresh(context.Background())

	if got := addresses(client.Instances("listing-service")); !slices.Equal(got, []string{"10.0.0.6:8002"}) {
		t.Errorf("Instances = %v", got)
	}
}

func TestIPv6AddressIsBracketed(t *testing.T) {
	fake := &fakeConsul{}
	fake.set("listing-service", entry("fd00::1", 8002))
	client := newTestClient(t, fake, "listing-service")

	client.Refresh(context.Background())

	if got := addresses(client.Instances("listing-service")); !slices.Equal(got, []string{"[fd00::1]:8002"}) {
		t.Errorf("Instances = %v", got)
	}
}

func TestKeepsLastSnapshotWhenConsulResponds500(t *testing.T) {
	fake := &fakeConsul{}
	fake.set("listing-service", entry("10.0.0.5", 8002))
	client := newTestClient(t, fake, "listing-service")
	client.Refresh(context.Background())

	fake.setStatus(http.StatusInternalServerError)
	client.Refresh(context.Background())

	if got := addresses(client.Instances("listing-service")); !slices.Equal(got, []string{"10.0.0.5:8002"}) {
		t.Errorf("Instances = %v: perdió el último snapshot", got)
	}
}

func TestKeepsLastSnapshotWhenConsulIsUnreachable(t *testing.T) {
	fake := &fakeConsul{}
	fake.set("listing-service", entry("10.0.0.5", 8002))
	server := httptest.NewServer(fake)
	client := NewClient(server.URL, []string{"listing-service"}, slog.New(slog.DiscardHandler))
	client.Refresh(context.Background())

	server.Close()
	client.Refresh(context.Background())

	if got := addresses(client.Instances("listing-service")); !slices.Equal(got, []string{"10.0.0.5:8002"}) {
		t.Errorf("Instances = %v: perdió el último snapshot", got)
	}
}

func TestKeepsLastSnapshotWhenConsulSendsGarbage(t *testing.T) {
	var garbage atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if garbage.Load() {
			_, _ = w.Write([]byte("no es json"))
			return
		}
		_ = json.NewEncoder(w).Encode([]consulEntry{entry("10.0.0.5", 8002)})
	}))
	t.Cleanup(server.Close)
	client := NewClient(server.URL, []string{"listing-service"}, slog.New(slog.DiscardHandler))
	client.Refresh(context.Background())

	garbage.Store(true)
	client.Refresh(context.Background())

	if got := addresses(client.Instances("listing-service")); !slices.Equal(got, []string{"10.0.0.5:8002"}) {
		t.Errorf("Instances = %v: perdió el último snapshot", got)
	}
}

// Una lista vacía es una respuesta válida: todas las réplicas están caídas, y eso debe dar 503.
func TestEmptyAnswerReplacesSnapshot(t *testing.T) {
	fake := &fakeConsul{}
	fake.set("listing-service", entry("10.0.0.5", 8002))
	client := newTestClient(t, fake, "listing-service")
	client.Refresh(context.Background())

	fake.set("listing-service")
	client.Refresh(context.Background())

	if got := client.Instances("listing-service"); len(got) != 0 {
		t.Errorf("Instances = %v, want vacío", got)
	}
}

func TestOneServiceFailingDoesNotAffectTheOthers(t *testing.T) {
	var failing atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if failing.Load() && strings.HasSuffix(r.URL.Path, "/listing-service") {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		port := 8001
		if strings.HasSuffix(r.URL.Path, "/listing-service") {
			port = 8002
		}
		_ = json.NewEncoder(w).Encode([]consulEntry{entry("10.0.0.5", port)})
	}))
	t.Cleanup(server.Close)
	client := NewClient(server.URL, []string{"listing-service", "identity-service"}, slog.New(slog.DiscardHandler))
	client.Refresh(context.Background())

	failing.Store(true)
	client.Refresh(context.Background())

	if got := addresses(client.Instances("listing-service")); !slices.Equal(got, []string{"10.0.0.5:8002"}) {
		t.Errorf("listing = %v", got)
	}
	if got := addresses(client.Instances("identity-service")); !slices.Equal(got, []string{"10.0.0.5:8001"}) {
		t.Errorf("identity = %v", got)
	}
}

func TestUnknownServiceHasNoInstances(t *testing.T) {
	client := newTestClient(t, &fakeConsul{}, "listing-service")

	if got := client.Instances("otro-service"); len(got) != 0 {
		t.Errorf("Instances = %v", got)
	}
}

func TestRunRefreshesPeriodicallyAndStopsWithContext(t *testing.T) {
	fake := &fakeConsul{}
	fake.set("listing-service", entry("10.0.0.5", 8002))
	client := newTestClient(t, fake, "listing-service")
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		client.Run(ctx, 5*time.Millisecond)
		close(done)
	}()

	deadline := time.After(5 * time.Second)
	for len(client.Instances("listing-service")) == 0 {
		select {
		case <-deadline:
			t.Fatal("Run no actualizó las réplicas")
		case <-time.After(time.Millisecond):
		}
	}
	fake.set("listing-service", entry("10.0.0.6", 8002))
	for !slices.Equal(addresses(client.Instances("listing-service")), []string{"10.0.0.6:8002"}) {
		select {
		case <-deadline:
			t.Fatal("Run no repitió la consulta")
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

func TestConcurrentReadsDuringRefresh(t *testing.T) {
	fake := &fakeConsul{}
	fake.set("listing-service", entry("10.0.0.5", 8002))
	client := newTestClient(t, fake, "listing-service")
	var wg sync.WaitGroup

	for range 20 {
		wg.Go(func() {
			for range 20 {
				_ = client.Instances("listing-service")
			}
		})
	}
	for range 5 {
		client.Refresh(context.Background())
	}
	wg.Wait()
}
