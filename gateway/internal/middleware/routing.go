package middleware

import (
	"context"
	"net/http"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/config"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/problem"
)

type routeKey struct{}

// RouteFrom devuelve la ruta resuelta por Routing.
func RouteFrom(ctx context.Context) (config.Route, bool) {
	route, ok := ctx.Value(routeKey{}).(config.Route)
	return route, ok
}

// Routing valida el path y resuelve la ruta una sola vez. Va antes del rate limit y de la auth: así
// ambos ven el mismo path ya validado, y el proxy no puede decidir distinto que ellos.
func Routing(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !config.ValidPath(r.URL.Path) {
			problem.Write(w, r, problem.BadRequest)
			return
		}
		route, ok := config.Resolve(r.Method, r.URL.Path)
		if !ok {
			problem.Write(w, r, problem.RouteNotFound)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), routeKey{}, route)))
	})
}
