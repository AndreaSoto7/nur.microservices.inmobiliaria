package middleware

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/auth"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/problem"
)

const bearerScheme = "Bearer"

// TokenValidator valida un access token. Lo implementa auth.Validator.
type TokenValidator interface {
	Validate(ctx context.Context, token string) error
}

// Auth exige un access token válido en las rutas protegidas, como defensa temprana. No modifica
// Authorization: cada servicio vuelve a validar el token y saca de él la identidad.
func Auth(validator TokenValidator, logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Sin ruta resuelta se trata como protegida: ante la duda, se exige token.
			if route, ok := RouteFrom(r.Context()); ok && route.Public {
				next.ServeHTTP(w, r)
				return
			}

			token, ok := bearerToken(r)
			if !ok {
				writeUnauthorized(w, r)
				return
			}
			err := validator.Validate(r.Context(), token)
			switch {
			case err == nil:
				next.ServeHTTP(w, r)
			case errors.Is(err, auth.ErrKeysUnavailable):
				// Un 401 le diría al cliente que su sesión venció, y el problema es de identity.
				logger.Warn("no se pudo validar el token: JWKS no disponible",
					"error", err, "correlationId", w.Header().Get(problem.CorrelationHeader))
				problem.Write(w, r, problem.NoHealthyInstance)
			default:
				writeUnauthorized(w, r)
			}
		})
	}
}

// bearerToken rechaza dos headers Authorization: el gateway validaría uno y el servicio podría leer
// el otro.
func bearerToken(r *http.Request) (string, bool) {
	values := r.Header.Values("Authorization")
	if len(values) != 1 {
		return "", false
	}
	scheme, token, found := strings.Cut(values[0], " ")
	if !found || !strings.EqualFold(scheme, bearerScheme) || token == "" {
		return "", false
	}
	return token, true
}

func writeUnauthorized(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("WWW-Authenticate", bearerScheme)
	problem.Write(w, r, problem.Unauthorized)
}
