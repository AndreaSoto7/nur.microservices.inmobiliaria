package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const (
	loginPath    = "/api/v1/auth/login"
	registerPath = "/api/v1/auth/register"
)

// fakeClock deja avanzar el tiempo sin dormir: los tests no dependen de la hora real.
type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func newFakeClock() *fakeClock {
	return &fakeClock{now: time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)}
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

func newLimited(perMinute int, clock *fakeClock) http.Handler {
	return NewRateLimiter(perMinute, clock.Now).Middleware(okHandler)
}

func doRequest(handler http.Handler, method, path, remoteAddr string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	req.RemoteAddr = remoteAddr
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestRateLimitBlocksRequestAfterTheLimit(t *testing.T) {
	for _, path := range []string{loginPath, registerPath} {
		t.Run(path, func(t *testing.T) {
			handler := newLimited(3, newFakeClock())

			for i := range 3 {
				if rec := doRequest(handler, http.MethodPost, path, "10.0.0.1:1000"); rec.Code != http.StatusOK {
					t.Fatalf("request %d: status = %d", i+1, rec.Code)
				}
			}

			rec := doRequest(handler, http.MethodPost, path, "10.0.0.1:1000")
			if rec.Code != http.StatusTooManyRequests {
				t.Fatalf("request N+1: status = %d", rec.Code)
			}
			if got := rec.Header().Get("Content-Type"); got != "application/problem+json" {
				t.Errorf("Content-Type = %q", got)
			}
			var body map[string]any
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body["code"] != "GATEWAY_RATE_LIMITED" {
				t.Errorf("code = %v", body["code"])
			}
			if got := rec.Header().Get("Retry-After"); got != "20" {
				t.Errorf("Retry-After = %q, want 20 (60 s / 3 requests)", got)
			}
		})
	}
}

// Con el puerto en la clave, cada conexión nueva tendría su propio límite y no serviría de nada.
func TestRateLimitIgnoresClientPort(t *testing.T) {
	handler := newLimited(1, newFakeClock())

	doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000")
	rec := doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:2000")

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("status = %d: otro puerto de la misma IP se saltó el límite", rec.Code)
	}
}

func TestRateLimitIgnoresForwardedFor(t *testing.T) {
	handler := newLimited(1, newFakeClock())

	for i := range 3 {
		req := httptest.NewRequest(http.MethodPost, loginPath, nil)
		req.RemoteAddr = "10.0.0.1:1000"
		req.Header.Set("X-Forwarded-For", fmt.Sprintf("203.0.113.%d", i))
		req.Header.Set("X-Real-Ip", fmt.Sprintf("203.0.113.%d", i))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if i > 0 && rec.Code != http.StatusTooManyRequests {
			t.Errorf("request %d: status = %d: X-Forwarded-For se saltó el límite", i+1, rec.Code)
		}
	}
}

func TestRateLimitIsPerIP(t *testing.T) {
	handler := newLimited(1, newFakeClock())

	doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000")
	rec := doRequest(handler, http.MethodPost, loginPath, "10.0.0.2:1000")

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d: una IP consumió el límite de otra", rec.Code)
	}
}

func TestRateLimitIsPerRoute(t *testing.T) {
	handler := newLimited(1, newFakeClock())

	doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000")
	rec := doRequest(handler, http.MethodPost, registerPath, "10.0.0.1:1000")

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d: el login consumió el límite del registro", rec.Code)
	}
}

func TestRateLimitOnlyAppliesToLoginAndRegisterPost(t *testing.T) {
	tests := []struct {
		name, method, path string
	}{
		{"refresh", http.MethodPost, "/api/v1/auth/refresh"},
		{"logout", http.MethodPost, "/api/v1/auth/logout"},
		{"jwks", http.MethodGet, "/api/v1/auth/.well-known/jwks.json"},
		{"GET al login", http.MethodGet, loginPath},
		{"otra ruta", http.MethodPost, "/api/v1/visits"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := newLimited(1, newFakeClock())
			for i := range 5 {
				if rec := doRequest(handler, tt.method, tt.path, "10.0.0.1:1000"); rec.Code != http.StatusOK {
					t.Fatalf("request %d: status = %d", i+1, rec.Code)
				}
			}
		})
	}
}

func TestRateLimitRefillsOverTime(t *testing.T) {
	clock := newFakeClock()
	handler := newLimited(2, clock)
	doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000")
	doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000")
	if rec := doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000"); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d", rec.Code)
	}

	clock.Advance(30 * time.Second)

	if rec := doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000"); rec.Code != http.StatusOK {
		t.Errorf("tras 30 s con 2/min: status = %d, want 200", rec.Code)
	}
	if rec := doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000"); rec.Code != http.StatusTooManyRequests {
		t.Errorf("el bucket debía quedar vacío otra vez: status = %d", rec.Code)
	}
}

func TestRateLimitExpiresOldEntries(t *testing.T) {
	clock := newFakeClock()
	limiter := NewRateLimiter(1, clock.Now)
	handler := limiter.Middleware(okHandler)
	for i := range 50 {
		doRequest(handler, http.MethodPost, loginPath, fmt.Sprintf("10.0.0.%d:1000", i))
	}
	if got := limiter.size(); got != 50 {
		t.Fatalf("entradas = %d, want 50", got)
	}

	clock.Advance(2 * time.Minute)
	doRequest(handler, http.MethodPost, loginPath, "10.0.1.1:1000")

	if got := limiter.size(); got != 1 {
		t.Errorf("entradas tras expirar = %d, want 1", got)
	}
}

// Una entrada solo puede borrarse cuando su bucket ya se rellenó: si no, expirar regalaría intentos.
func TestRateLimitExpiryDoesNotResetActiveClient(t *testing.T) {
	clock := newFakeClock()
	handler := newLimited(1, clock)

	doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000")
	clock.Advance(59 * time.Second)
	doRequest(handler, http.MethodPost, loginPath, "10.0.0.2:1000")

	rec := doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000")
	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("status = %d: la limpieza le devolvió intentos a un cliente activo", rec.Code)
	}
}

func TestRateLimitAllowsExactlyTheLimitUnderConcurrency(t *testing.T) {
	handler := newLimited(10, newFakeClock())
	var allowed atomic.Int64
	var wg sync.WaitGroup

	for range 100 {
		wg.Go(func() {
			if rec := doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000"); rec.Code == http.StatusOK {
				allowed.Add(1)
			}
		})
	}
	wg.Wait()

	if got := allowed.Load(); got != 10 {
		t.Errorf("permitidas = %d, want 10", got)
	}
}

// Sin IP no hay clave: es preferible compartir el límite que dejar pasar sin límite.
func TestRateLimitWithUnparsableRemoteAddrStillLimits(t *testing.T) {
	handler := newLimited(1, newFakeClock())

	doRequest(handler, http.MethodPost, loginPath, "no-es-una-direccion")
	rec := doRequest(handler, http.MethodPost, loginPath, "no-es-una-direccion")

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("status = %d", rec.Code)
	}
}

// net/http acepta "post" como método, y Django lo atiende igual: no puede quedar fuera del límite.
func TestRateLimitAppliesToLowercaseMethod(t *testing.T) {
	handler := newLimited(1, newFakeClock())

	doRequest(handler, http.MethodPost, loginPath, "10.0.0.1:1000")
	rec := doRequest(handler, "post", loginPath, "10.0.0.1:1000")

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("status = %d: el método en minúscula se saltó el límite", rec.Code)
	}
}

func TestRateLimitClientKey(t *testing.T) {
	tests := []struct {
		name          string
		first, second string
		sameBucket    bool
	}{
		{"IPv6 en el mismo /64", "[2001:db8:1:2::1]:1000", "[2001:db8:1:2:ffff::9]:1000", true},
		{"IPv6 en otro /64", "[2001:db8:1:2::1]:1000", "[2001:db8:1:3::1]:1000", false},
		{"IPv4 mapeada a IPv6 es la misma IP", "10.0.0.1:1000", "[::ffff:10.0.0.1]:1000", true},
		{"IPv4 no se agrupa por red", "10.0.0.1:1000", "10.0.0.2:1000", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := newLimited(1, newFakeClock())

			doRequest(handler, http.MethodPost, loginPath, tt.first)
			rec := doRequest(handler, http.MethodPost, loginPath, tt.second)

			if got := rec.Code == http.StatusTooManyRequests; got != tt.sameBucket {
				t.Errorf("status = %d, sameBucket = %v", rec.Code, tt.sameBucket)
			}
		})
	}
}
