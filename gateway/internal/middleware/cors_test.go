package middleware

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
)

const allowedOrigin = "http://localhost:5173"

func corsRequest(method, origin string, headers map[string]string) *http.Request {
	req := httptest.NewRequest(method, "/api/v1/users/me", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	return req
}

func preflightHeaders() map[string]string {
	return map[string]string{
		"Access-Control-Request-Method":  http.MethodPost,
		"Access-Control-Request-Headers": "authorization,content-type",
	}
}

func TestCORSPreflightFromAllowedOriginAnswersWithoutReachingNext(t *testing.T) {
	reached := false
	handler := CORS([]string{allowedOrigin})(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		reached = true
	}))
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, corsRequest(http.MethodOptions, allowedOrigin, preflightHeaders()))

	if reached {
		t.Error("el preflight llegó al siguiente eslabón: la auth lo rechazaría")
	}
	if rec.Code != http.StatusNoContent {
		t.Errorf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != allowedOrigin {
		t.Errorf("Allow-Origin = %q", got)
	}
	methods := rec.Header().Get("Access-Control-Allow-Methods")
	for _, method := range []string{"GET", "POST", "PUT", "PATCH", "DELETE"} {
		if !strings.Contains(methods, method) {
			t.Errorf("Allow-Methods = %q: falta %s", methods, method)
		}
	}
	headers := strings.ToLower(rec.Header().Get("Access-Control-Allow-Headers"))
	for _, header := range []string{"authorization", "content-type", "idempotency-key", "x-correlation-id"} {
		if !strings.Contains(headers, header) {
			t.Errorf("Allow-Headers = %q: falta %s", headers, header)
		}
	}
	if rec.Header().Get("Access-Control-Max-Age") == "" {
		t.Error("falta Max-Age: el navegador repetiría el preflight en cada request")
	}
}

func TestCORSPreflightFromUnknownOriginGetsNoPermission(t *testing.T) {
	reached := false
	handler := CORS([]string{allowedOrigin})(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		reached = true
	}))
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, corsRequest(http.MethodOptions, "https://malicioso.example", preflightHeaders()))

	if reached {
		t.Error("el preflight de un origen desconocido llegó al siguiente eslabón")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Allow-Origin = %q, want vacío", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Methods"); got != "" {
		t.Errorf("Allow-Methods = %q, want vacío", got)
	}
}

func TestCORSComparesOriginExactly(t *testing.T) {
	tests := []struct {
		name, origin string
	}{
		{"subdominio del permitido", "http://localhost.malicioso.example:5173"},
		{"otro puerto", "http://localhost:5174"},
		{"otro esquema", "https://localhost:5173"},
		{"con barra final", "http://localhost:5173/"},
		{"null", "null"},
		{"comodín", "*"},
		{"mayúsculas", "HTTP://LOCALHOST:5173"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()

			CORS([]string{allowedOrigin})(okHandler).ServeHTTP(rec, corsRequest(http.MethodGet, tt.origin, nil))

			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
				t.Errorf("Allow-Origin = %q para el origen %q", got, tt.origin)
			}
		})
	}
}

func TestCORSActualRequestFromAllowedOrigin(t *testing.T) {
	rec := httptest.NewRecorder()

	CORS([]string{allowedOrigin})(okHandler).ServeHTTP(rec, corsRequest(http.MethodGet, allowedOrigin, nil))

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != allowedOrigin {
		t.Errorf("Allow-Origin = %q", got)
	}
	exposed := rec.Header().Get("Access-Control-Expose-Headers")
	for _, header := range []string{"X-Correlation-Id", "Retry-After", "Location"} {
		if !strings.Contains(exposed, header) {
			t.Errorf("Expose-Headers = %q: falta %s", exposed, header)
		}
	}
}

// Con Bearer el navegador no necesita mandar cookies: permitirlas solo agrandaría la superficie.
func TestCORSNeverAllowsCredentials(t *testing.T) {
	rec := httptest.NewRecorder()

	CORS([]string{allowedOrigin})(okHandler).ServeHTTP(rec, corsRequest(http.MethodOptions, allowedOrigin, preflightHeaders()))

	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf("Allow-Credentials = %q", got)
	}
}

// Sin Vary, una caché podría servirle a otro origen la respuesta con el Allow-Origin de este.
func TestCORSAlwaysVariesByOrigin(t *testing.T) {
	tests := []struct {
		name, origin string
	}{
		{"origen permitido", allowedOrigin},
		{"origen desconocido", "https://malicioso.example"},
		{"sin origen", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()

			CORS([]string{allowedOrigin})(okHandler).ServeHTTP(rec, corsRequest(http.MethodGet, tt.origin, nil))

			if !slices.Contains(rec.Header().Values("Vary"), "Origin") {
				t.Errorf("Vary = %v", rec.Header().Values("Vary"))
			}
		})
	}
}

// Un OPTIONS sin Access-Control-Request-Method no es un preflight: lo decide el resto de la cadena.
func TestCORSPlainOptionsPassesThrough(t *testing.T) {
	reached := false
	handler := CORS([]string{allowedOrigin})(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		reached = true
	}))

	handler.ServeHTTP(httptest.NewRecorder(), corsRequest(http.MethodOptions, allowedOrigin, nil))

	if !reached {
		t.Error("un OPTIONS común no llegó al siguiente eslabón")
	}
}

func TestCORSAcceptsSeveralOrigins(t *testing.T) {
	second := "https://app.example.com"
	rec := httptest.NewRecorder()

	CORS([]string{allowedOrigin, second})(okHandler).ServeHTTP(rec, corsRequest(http.MethodGet, second, nil))

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != second {
		t.Errorf("Allow-Origin = %q", got)
	}
}
