package jwks

import (
	"context"
	"crypto/rsa"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const accessTokenType = "at+jwt"

// ErrInvalidToken indica que el token no sirve: falta, venció o no pasó alguna verificación.
var ErrInvalidToken = errors.New("token inválido")

// KeyProvider entrega la clave pública de un kid. Lo implementa KeySet.
type KeyProvider interface {
	Key(ctx context.Context, kid string) (*rsa.PublicKey, error)
}

// Validator valida el access token. El servicio no confía en la validación del gateway.
type Validator struct {
	keys   KeyProvider
	parser *jwt.Parser
}

// NewValidator fija el algoritmo y los claims exigidos: el algoritmo nunca lo decide el token, y así
// se descartan alg=none y HS256 firmado con la clave pública.
func NewValidator(keys KeyProvider, issuer, audience string, now func() time.Time) *Validator {
	return &Validator{
		keys: keys,
		parser: jwt.NewParser(
			jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
			jwt.WithExpirationRequired(),
			jwt.WithIssuer(issuer),
			jwt.WithAudience(audience),
			jwt.WithTimeFunc(now),
		),
	}
}

// Validate devuelve el usuario del token (`sub`). El error envuelve ErrInvalidToken o ErrKeysUnavailable.
func (v *Validator) Validate(ctx context.Context, tokenString string) (string, error) {
	var claims jwt.RegisteredClaims
	_, err := v.parser.ParseWithClaims(tokenString, &claims, func(token *jwt.Token) (any, error) {
		// typ separa los dos tokens de identity: un refresh token (rt+jwt) nunca pasa como acceso.
		if typ, _ := token.Header["typ"].(string); typ != accessTokenType {
			return nil, fmt.Errorf("typ %q no permitido", typ)
		}
		kid, _ := token.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("falta el kid")
		}
		return v.keys.Key(ctx, kid)
	})
	switch {
	case errors.Is(err, ErrKeysUnavailable):
		return "", fmt.Errorf("validar el token: %w", err)
	case err != nil:
		return "", fmt.Errorf("%w: %w", ErrInvalidToken, err)
	}
	// El sub identifica al dueño de los avisos: sin un UUID válido no hay de quién leerlos.
	parsed, err := uuid.Parse(claims.Subject)
	if err != nil {
		return "", fmt.Errorf("%w: sub inválido", ErrInvalidToken)
	}
	return parsed.String(), nil
}
