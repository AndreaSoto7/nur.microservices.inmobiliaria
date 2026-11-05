package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/config"
)

func routeThrough(req *http.Request) (*httptest.ResponseRecorder, config.Route, bool) {
	var route config.Route
	var found bool
	handler := Routing(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		route, found = RouteFrom(r.Context())
	}))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec, route, found
}

func TestRoutingPutsRouteInContext(t *testing.T) {
	_, route, found := routeThrough(httptest.NewRequest(http.MethodGet, "/api/v1/catalog/properties", nil))

	if !found {
		t.Fatal("la request no llegó al siguiente eslabón")
	}
	if route.Service != "listing-service" || !route.Public {
		t.Errorf("route = %+v", route)
	}
}

func TestRoutingRejectsInvalidPathsWith400(t *testing.T) {
	// httptest.NewRequest parsea la URL igual que el servidor: %2e llega decodificado a URL.Path.
	targets := []string{
		"/api/v1/auth/../users/me",
		"/api/v1/auth/%2e%2e/users/me",
		"/api/v1/auth/%2E%2E%2Fusers%2Fme",
		"/api/v1/auth//login",
		"/api/v1/auth/login/",
		"/api/v1/auth/login%2F",
		"/api/v1/properties/x/images/..;",
		"/api/v1/auth/%252e%252e/users/me",
		"/api/v1/auth/login%00",
		"/api/v1/auth/..%5Cusers",
	}

	for _, target := range targets {
		t.Run(target, func(t *testing.T) {
			rec, _, found := routeThrough(httptest.NewRequest(http.MethodGet, target, nil))

			if found {
				t.Error("el path inválido llegó al siguiente eslabón")
			}
			assertProblem(t, rec, http.StatusBadRequest, "GATEWAY_BAD_REQUEST")
		})
	}
}

func TestRoutingUnknownPrefixGives404(t *testing.T) {
	rec, _, found := routeThrough(httptest.NewRequest(http.MethodGet, "/api/v1/otra-cosa", nil))

	if found {
		t.Error("la ruta desconocida llegó al siguiente eslabón")
	}
	assertProblem(t, rec, http.StatusNotFound, "GATEWAY_ROUTE_NOT_FOUND")
}

func TestRouteFromWithoutRoutingFindsNothing(t *testing.T) {
	if _, found := RouteFrom(httptest.NewRequest(http.MethodGet, "/", nil).Context()); found {
		t.Error("encontró una ruta sin pasar por Routing")
	}
}

func assertProblem(t *testing.T, rec *httptest.ResponseRecorder, status int, code string) {
	t.Helper()
	if rec.Code != status {
		t.Errorf("status = %d, want %d", rec.Code, status)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body no es JSON: %v", err)
	}
	if body["code"] != code {
		t.Errorf("code = %v, want %s", body["code"], code)
	}
}
