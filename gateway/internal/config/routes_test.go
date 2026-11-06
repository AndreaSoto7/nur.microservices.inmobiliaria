package config

import (
	"net/http"
	"slices"
	"testing"
)

func TestResolveFindsServiceAndAccess(t *testing.T) {
	const (
		identity     = "identity-service"
		listing      = "listing-service"
		visit        = "visit-service"
		audit        = "audit-service"
		notification = "notification-service"
		imageURL     = "/api/v1/properties/3f6c/images/9a1b"
	)
	tests := []struct {
		method, path string
		service      string
		public       bool
	}{
		{http.MethodPost, "/api/v1/auth/register", identity, true},
		{http.MethodPost, "/api/v1/auth/login", identity, true},
		{http.MethodPost, "/api/v1/auth/refresh", identity, true},
		{http.MethodPost, "/api/v1/auth/logout", identity, true},
		{http.MethodGet, "/api/v1/auth/.well-known/jwks.json", identity, true},
		{http.MethodGet, "/api/v1/users/me", identity, false},

		{http.MethodGet, "/api/v1/catalog/properties", listing, true},
		{http.MethodGet, "/api/v1/catalog/properties/3f6c", listing, true},
		{http.MethodGet, imageURL, listing, true},
		{http.MethodGet, "/api/v1/properties", listing, false},
		{http.MethodPost, "/api/v1/properties", listing, false},
		{http.MethodGet, "/api/v1/properties/3f6c", listing, false},
		{http.MethodPost, "/api/v1/properties/3f6c/publish", listing, false},
		{http.MethodPost, "/api/v1/properties/3f6c/images", listing, false},
		{http.MethodGet, "/api/v1/favorites", listing, false},
		{http.MethodDelete, "/api/v1/favorites/3f6c", listing, false},

		{http.MethodPost, "/api/v1/inquiries", visit, false},
		{http.MethodGet, "/api/v1/visits", visit, false},
		{http.MethodPost, "/api/v1/visits/3f6c/schedule", visit, false},
		{http.MethodGet, "/api/v1/leads", visit, false},

		{http.MethodGet, "/api/v1/audit/events", audit, false},

		{http.MethodGet, "/api/v1/notifications", notification, false},
		{http.MethodPatch, "/api/v1/notifications/3f6c", notification, false},

		// El acceso público es por método y path exactos: lo demás exige JWT.
		{http.MethodGet, "/api/v1/auth/login", identity, false},
		{http.MethodPost, "/api/v1/auth/otra-cosa", identity, false},
		{http.MethodPost, "/api/v1/catalog/properties", listing, false},
		{http.MethodDelete, imageURL, listing, false},
		{http.MethodGet, "/api/v1/properties/3f6c/images", listing, false},
		{http.MethodGet, imageURL + "/extra", listing, false},
		{http.MethodGet, "/api/v1/users/.well-known/jwks.json", identity, false},
		{"post", "/api/v1/auth/login", identity, false},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			route, ok := Resolve(tt.method, tt.path)
			if !ok {
				t.Fatal("no encontró la ruta")
			}
			if route.Service != tt.service {
				t.Errorf("Service = %q, want %q", route.Service, tt.service)
			}
			if route.Public != tt.public {
				t.Errorf("Public = %v, want %v", route.Public, tt.public)
			}
		})
	}
}

func TestResolveRejectsUnknownPrefixes(t *testing.T) {
	paths := []string{
		"/",
		"/health",
		"/api",
		"/api/v1",
		"/api/v1/otra-cosa",
		"/api/v2/properties",
		// Un prefijo se compara por segmentos: "properties-falso" no es "properties".
		"/api/v1/properties-falso",
		"/api/v1/authx/login",
		"/API/V1/PROPERTIES",
		// Fuera de alcance (ADR 0005).
		"/api/v1/search/properties",
	}

	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			if route, ok := Resolve(http.MethodGet, path); ok {
				t.Errorf("Resolve() = %+v, want ninguna", route)
			}
		})
	}
}

func TestValidPath(t *testing.T) {
	tests := []struct {
		name, path string
		valid      bool
	}{
		{"ruta normal", "/api/v1/properties/3f6c-1b2d", true},
		{"jwks con punto", "/api/v1/auth/.well-known/jwks.json", true},
		{"raíz", "/", true},
		{"punto dentro de un segmento", "/api/v1/properties/a..b", true},

		{"vacío", "", false},
		{"asterisco de OPTIONS", "*", false},
		{"sin barra inicial", "api/v1/users", false},
		{"dos puntos", "/api/v1/auth/../users/me", false},
		{"dos puntos al final", "/api/v1/auth/login/..", false},
		{"un punto", "/api/v1/auth/./login", false},
		{"doble barra", "/api/v1/auth//login", false},
		{"doble barra inicial", "//api/v1/users/me", false},
		{"barra final", "/api/v1/auth/login/", false},
		// Tomcat trata "..;" como "..": un path así se saltaría el JWT en listing.
		{"parámetro de path", "/api/v1/properties/x/images/..;", false},
		{"punto y coma", "/api/v1/auth/login;x=1", false},
		{"barra invertida", "/api/v1/auth/..\\users", false},
		{"byte nulo", "/api/v1/auth/login\x00", false},
		{"salto de línea", "/api/v1/auth/login\n", false},
		{"DEL", "/api/v1/auth/login\x7f", false},
		// Ya decodificado una vez: un "%" restante es doble codificación.
		{"doble codificación", "/api/v1/auth/%2e%2e/users/me", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ValidPath(tt.path); got != tt.valid {
				t.Errorf("ValidPath(%q) = %v, want %v", tt.path, got, tt.valid)
			}
		})
	}
}

func TestServicesListsEachServiceOnce(t *testing.T) {
	want := []string{"audit-service", "identity-service", "listing-service", "notification-service", "visit-service"}

	if got := Services(); !slices.Equal(got, want) {
		t.Errorf("Services() = %v, want %v", got, want)
	}
}

func TestIsAuthPath(t *testing.T) {
	tests := map[string]bool{
		"/api/v1/auth":                       true,
		"/api/v1/auth/login":                 true,
		"/api/v1/auth/.well-known/jwks.json": true,
		"/api/v1/authx":                      false,
		"/api/v1/users/me":                   false,
	}

	for path, want := range tests {
		if got := IsAuthPath(path); got != want {
			t.Errorf("IsAuthPath(%q) = %v, want %v", path, got, want)
		}
	}
}

func TestIsImageUpload(t *testing.T) {
	tests := []struct {
		method, path string
		want         bool
	}{
		{http.MethodPost, "/api/v1/properties/3f6c/images", true},
		{http.MethodGet, "/api/v1/properties/3f6c/images", false},
		{http.MethodPost, "/api/v1/properties/3f6c/images/9a1b", false},
		{http.MethodPost, "/api/v1/properties/3f6c/publish", false},
		{http.MethodPost, "/api/v1/favorites/3f6c/images", false},
		{http.MethodPost, "/api/v1/properties", false},
	}

	for _, tt := range tests {
		if got := IsImageUpload(tt.method, tt.path); got != tt.want {
			t.Errorf("IsImageUpload(%s, %q) = %v, want %v", tt.method, tt.path, got, tt.want)
		}
	}
}
