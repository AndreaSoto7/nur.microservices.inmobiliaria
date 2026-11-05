package middleware

import (
	"net/http"
	"slices"
)

const (
	corsAllowedMethods = "GET, POST, PUT, PATCH, DELETE"
	corsAllowedHeaders = "Authorization, Content-Type, Idempotency-Key, X-Correlation-Id"
	// Sin estos, el frontend no puede leerlos en una respuesta de otro origen.
	corsExposedHeaders = "X-Correlation-Id, Retry-After, Location"
	corsPreflightCache = "600"
)

// CORS permite solo los orígenes configurados, con comparación exacta y nunca "*". No habilita
// credenciales: el frontend se autentica con Bearer, no con cookies.
func CORS(allowedOrigins []string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Vary va siempre: si no, una caché podría servirle a otro origen esta misma respuesta.
			w.Header().Add("Vary", "Origin")
			origin := r.Header.Get("Origin")
			allowed := slices.Contains(allowedOrigins, origin)

			if isPreflight(r) {
				w.Header().Add("Vary", "Access-Control-Request-Method")
				w.Header().Add("Vary", "Access-Control-Request-Headers")
				if allowed {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Access-Control-Allow-Methods", corsAllowedMethods)
					w.Header().Set("Access-Control-Allow-Headers", corsAllowedHeaders)
					w.Header().Set("Access-Control-Max-Age", corsPreflightCache)
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Expose-Headers", corsExposedHeaders)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// isPreflight distingue el preflight de un OPTIONS común, que sigue por el resto de la cadena.
func isPreflight(r *http.Request) bool {
	return r.Method == http.MethodOptions &&
		r.Header.Get("Origin") != "" &&
		r.Header.Get("Access-Control-Request-Method") != ""
}
