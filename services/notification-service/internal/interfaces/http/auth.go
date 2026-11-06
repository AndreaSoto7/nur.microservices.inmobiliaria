package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/infrastructure/jwks"
)

const bearerScheme = "Bearer"

// TokenValidator valida un access token y devuelve su usuario. Lo implementa jwks.Validator.
type TokenValidator interface {
	Validate(ctx context.Context, token string) (string, error)
}

type userKey struct{}

func userFrom(ctx context.Context) string {
	userID, _ := ctx.Value(userKey{}).(string)
	return userID
}

// requireUser exige un access token válido. El usuario sale siempre del token: el servicio no le cree a
// ningún header ni parámetro del cliente, ni delega esta validación en el gateway.
func requireUser(deps Dependencies, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearerToken(r)
		if !ok {
			writeUnauthorized(w, r)
			return
		}
		userID, err := deps.Validator.Validate(r.Context(), token)
		switch {
		case err == nil:
			next(w, r.WithContext(context.WithValue(r.Context(), userKey{}, userID)))
		case errors.Is(err, jwks.ErrKeysUnavailable):
			// Un 401 le diría al cliente que su sesión venció, y el problema es de identity.
			deps.Logger.Warn("no se pudo validar el token: JWKS no disponible",
				"error", err, "correlationId", r.Header.Get(CorrelationHeader))
			writeProblem(w, r, problemUnavailable)
		default:
			writeUnauthorized(w, r)
		}
	}
}

// bearerToken rechaza dos headers Authorization: no debe quedar duda de cuál se validó.
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
	writeProblem(w, r, problemInvalidToken)
}
