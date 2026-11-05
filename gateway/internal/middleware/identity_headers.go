package middleware

import (
	"net/http"
	"strings"
)

const identityHeaderPrefix = "x-user-"

// StripIdentityHeaders borra los X-User-* del cliente: ningún servicio debe poder creerse una
// identidad que no viene de un JWT validado. Compara también con "_" porque WSGI lo convierte en "-",
// y Django vería X_User_Id como si fuera X-User-Id.
func StripIdentityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for key := range r.Header {
			normalized := strings.ReplaceAll(strings.ToLower(key), "_", "-")
			if strings.HasPrefix(normalized, identityHeaderPrefix) {
				delete(r.Header, key)
			}
		}
		next.ServeHTTP(w, r)
	})
}
