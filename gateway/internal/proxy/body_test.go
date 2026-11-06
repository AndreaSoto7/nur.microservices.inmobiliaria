package proxy

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestBodyLimitPerRoute(t *testing.T) {
	const (
		authLimit    = 64 << 10
		defaultLimit = 1 << 20
	)
	tests := []struct {
		name, path string
		size       int
		allowed    bool
	}{
		{"auth en el límite", loginPath, authLimit, true},
		{"auth sobre el límite", loginPath, authLimit + 1, false},
		{"por defecto en el límite", listPath, defaultLimit, true},
		{"por defecto sobre el límite", listPath, defaultLimit + 1, false},
		{"imágenes usa MAX_BODY_BYTES", uploadPath, imageBodyLimit, true},
		{"imágenes sobre MAX_BODY_BYTES", uploadPath, imageBodyLimit + 1, false},
	}

	for _, tt := range tests {
		// Con Content-Length se rechaza antes; sin él, recién al pasarse leyendo. Los dos dan 413.
		for _, chunked := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s chunked=%v", tt.name, chunked), func(t *testing.T) {
				backend := newBackend(t, func(_ http.ResponseWriter, r *http.Request) {
					_, _ = io.Copy(io.Discard, r.Body)
				})
				gateway, picker := gatewayTo(t, map[string]*httptest.Server{
					"identity-service": backend,
					"listing-service":  backend,
				})

				var body io.Reader = strings.NewReader(strings.Repeat("x", tt.size))
				if chunked {
					body = io.MultiReader(body)
				}
				resp, err := http.Post(gateway.URL+tt.path, "application/octet-stream", body)
				if err != nil {
					t.Fatal(err)
				}
				defer resp.Body.Close()

				if tt.allowed && resp.StatusCode != http.StatusOK {
					t.Errorf("status = %d, want 200", resp.StatusCode)
				}
				if !tt.allowed {
					assertProblem(t, resp, http.StatusRequestEntityTooLarge, "GATEWAY_PAYLOAD_TOO_LARGE")
				}
				if got := picker.markedAddresses(); len(got) != 0 {
					t.Errorf("marcadas = %v: la culpa fue del cliente", got)
				}
			})
		}
	}
}

func TestDeclaredOversizeBodyNeverReachesReplica(t *testing.T) {
	var hits atomic.Int64
	backend := newBackend(t, func(http.ResponseWriter, *http.Request) { hits.Add(1) })
	gateway, _ := gatewayTo(t, map[string]*httptest.Server{"identity-service": backend})

	resp, err := http.Post(gateway.URL+loginPath, "application/json", strings.NewReader(strings.Repeat("x", 65<<10)))
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()

	if got := hits.Load(); got != 0 {
		t.Errorf("llegó %d veces a la réplica", got)
	}
}

// Si marcara, una sola request malformada sacaría réplicas de servicio.
func TestMalformedChunkedBodyRespondsBadRequestWithoutMarking(t *testing.T) {
	backend := newBackend(t, func(_ http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
	})
	gateway, picker := gatewayTo(t, map[string]*httptest.Server{"listing-service": backend})

	resp := rawRequest(t, gateway, "POST "+listPath+" HTTP/1.1\r\nHost: x\r\n"+
		"Transfer-Encoding: chunked\r\n\r\nzzz\r\nno-es-chunked\r\n")

	assertProblem(t, resp, http.StatusBadRequest, "GATEWAY_BAD_REQUEST")
	if got := picker.markedAddresses(); len(got) != 0 {
		t.Errorf("marcadas = %v", got)
	}
}

// Dos clientes que nunca terminan de enviar el body bloquearían a identity, que atiende pocos a la vez.
func TestSlowClientOnAuthIsCutWithoutMarking(t *testing.T) {
	backend := newBackend(t, func(_ http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
	})
	gateway, picker := gatewayTo(t, map[string]*httptest.Server{"identity-service": backend})

	start := time.Now()
	resp := rawRequest(t, gateway, "POST "+loginPath+" HTTP/1.1\r\nHost: x\r\n"+
		"Content-Length: 100\r\n\r\nparcial")

	assertProblem(t, resp, http.StatusBadRequest, "GATEWAY_BAD_REQUEST")
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Errorf("tardó %v en cortar", elapsed)
	}
	if got := picker.markedAddresses(); len(got) != 0 {
		t.Errorf("marcadas = %v", got)
	}
}

// El deadline de lectura solo cubre el body: net/http lo quita al llegar al final. Si dejara de hacerlo,
// cancelaría la request aunque el cliente ya lo envió todo y solo identity esté tardando (hashear es lento).
func TestAuthReadDeadlineDoesNotCutSlowReplica(t *testing.T) {
	bodies := []struct {
		name string
		body func() io.Reader
	}{
		{"con Content-Length", func() io.Reader { return strings.NewReader("{}") }},
		{"chunked", func() io.Reader { return io.MultiReader(strings.NewReader("{}")) }},
	}

	for _, tt := range bodies {
		t.Run(tt.name, func(t *testing.T) {
			backend := newBackend(t, func(w http.ResponseWriter, r *http.Request) {
				_, _ = io.Copy(io.Discard, r.Body)
				time.Sleep(authReadWait + 50*time.Millisecond)
				_, _ = w.Write([]byte("ok"))
			})
			gateway, picker := gatewayTo(t, map[string]*httptest.Server{"identity-service": backend})

			resp, err := http.Post(gateway.URL+loginPath, "application/json", tt.body())
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)

			if resp.StatusCode != http.StatusOK || string(body) != "ok" {
				t.Errorf("status = %d, body = %q", resp.StatusCode, body)
			}
			if got := picker.markedAddresses(); len(got) != 0 {
				t.Errorf("marcadas = %v", got)
			}
		})
	}
}

// Sin body no se fija deadline: net/http no lo quitaría, y cancelaría la request al vencer.
func TestAuthRequestWithoutBodyHasNoReadDeadline(t *testing.T) {
	backend := newBackend(t, func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(authReadWait + 50*time.Millisecond)
		_, _ = w.Write([]byte("ok"))
	})
	gateway, _ := gatewayTo(t, map[string]*httptest.Server{"identity-service": backend})

	resp, err := http.Get(gateway.URL + "/api/v1/auth/.well-known/jwks.json")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d", resp.StatusCode)
	}
}
