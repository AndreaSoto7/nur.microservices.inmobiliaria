package middleware

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/auth"
)

type fakeValidator struct {
	err      error
	received []string
}

func (f *fakeValidator) Validate(_ context.Context, token string) error {
	f.received = append(f.received, token)
	return f.err
}

// serveAuth pasa por Routing, como en la cadena real: Auth depende de la ruta que este resuelve.
func serveAuth(validator TokenValidator, req *http.Request) (*httptest.ResponseRecorder, *http.Request) {
	var reached *http.Request
	handler := Routing(Auth(validator, discardLogger())(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		reached = r
	})))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec, reached
}

func TestAuthRejectsRequestsWithoutUsableBearer(t *testing.T) {
	tests := []struct {
		name    string
		headers []string
	}{
		{"sin header", nil},
		{"esquema Basic", []string{"Basic abc"}},
		{"Bearer sin token", []string{"Bearer "}},
		{"solo la palabra Bearer", []string{"Bearer"}},
		{"el token sin esquema", []string{"abc.def.ghi"}},
		// El gateway validaría uno y el servicio podría leer el otro.
		{"dos headers", []string{"Bearer bueno", "Bearer otro"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			validator := &fakeValidator{}
			req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
			for _, header := range tt.headers {
				req.Header.Add("Authorization", header)
			}

			rec, reached := serveAuth(validator, req)

			if reached != nil {
				t.Error("la request llegó al proxy")
			}
			if len(validator.received) != 0 {
				t.Errorf("llamó al validador con %v", validator.received)
			}
			assertProblem(t, rec, http.StatusUnauthorized, "GATEWAY_UNAUTHORIZED")
			if got := rec.Header().Get("WWW-Authenticate"); got != "Bearer" {
				t.Errorf("WWW-Authenticate = %q", got)
			}
		})
	}
}

func TestAuthRejectsInvalidToken(t *testing.T) {
	validator := &fakeValidator{err: fmt.Errorf("%w: vencido", auth.ErrInvalidToken)}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer abc")

	rec, reached := serveAuth(validator, req)

	if reached != nil {
		t.Error("la request llegó al proxy")
	}
	assertProblem(t, rec, http.StatusUnauthorized, "GATEWAY_UNAUTHORIZED")
}

// Un 401 le diría al cliente que su sesión venció, y el problema es que identity no responde.
func TestAuthRespondsUnavailableWhenKeysCannotBeLoaded(t *testing.T) {
	validator := &fakeValidator{err: fmt.Errorf("validar: %w", auth.ErrKeysUnavailable)}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer abc")

	rec, reached := serveAuth(validator, req)

	if reached != nil {
		t.Error("la request llegó al proxy")
	}
	assertProblem(t, rec, http.StatusServiceUnavailable, "GATEWAY_NO_HEALTHY_INSTANCE")
}

func TestAuthForwardsAuthorizationIntact(t *testing.T) {
	tests := []struct {
		name, header, token string
	}{
		{"esquema normal", "Bearer abc.def.ghi", "abc.def.ghi"},
		{"esquema en minúsculas", "bearer abc.def.ghi", "abc.def.ghi"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			validator := &fakeValidator{}
			req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me", nil)
			req.Header.Set("Authorization", tt.header)

			_, reached := serveAuth(validator, req)

			if reached == nil {
				t.Fatal("la request no llegó al proxy")
			}
			if got := reached.Header.Get("Authorization"); got != tt.header {
				t.Errorf("Authorization = %q, want %q", got, tt.header)
			}
			if len(validator.received) != 1 || validator.received[0] != tt.token {
				t.Errorf("validó %v, want %s", validator.received, tt.token)
			}
		})
	}
}

// El refresh y el logout se usan justo cuando el access token ya venció.
func TestAuthDoesNotCheckPublicRoutes(t *testing.T) {
	tests := []struct {
		method, path string
	}{
		{http.MethodPost, "/api/v1/auth/login"},
		{http.MethodPost, "/api/v1/auth/refresh"},
		{http.MethodPost, "/api/v1/auth/logout"},
		{http.MethodGet, "/api/v1/catalog/properties"},
		{http.MethodGet, "/api/v1/properties/3f6c/images/9a1b"},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			validator := &fakeValidator{err: auth.ErrInvalidToken}
			req := httptest.NewRequest(tt.method, tt.path, nil)
			req.Header.Set("Authorization", "Bearer vencido")

			_, reached := serveAuth(validator, req)

			if reached == nil {
				t.Error("una ruta pública exigió token")
			}
			if len(validator.received) != 0 {
				t.Error("validó el token en una ruta pública")
			}
		})
	}
}

// Sin ruta resuelta no hay forma de saber si es pública: se trata como protegida.
func TestAuthWithoutRouteFailsClosed(t *testing.T) {
	handler := Auth(&fakeValidator{}, discardLogger())(okHandler)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/properties", nil))

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d", rec.Code)
	}
}
