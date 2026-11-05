package auth

import (
	"context"
	"crypto/rsa"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const accessTokenType = "at+jwt"

// ErrInvalidToken indica que el token no sirve: falta, venció o no pasó alguna verificación.
var ErrInvalidToken = errors.New("token inválido")

// KeyProvider entrega la clave pública de un kid. Lo implementa KeySet.
type KeyProvider interface {
	Key(ctx context.Context, kid string) (*rsa.PublicKey, error)
}

// Validator valida el access token como defensa temprana. Cada servicio lo vuelve a validar.
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

// Validate devuelve un error que envuelve ErrInvalidToken o ErrKeysUnavailable.
func (v *Validator) Validate(ctx context.Context, tokenString string) error {
	_, err := v.parser.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (any, error) {
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
	case err == nil:
		return nil
	case errors.Is(err, ErrKeysUnavailable):
		return fmt.Errorf("validar el token: %w", err)
	default:
		return fmt.Errorf("%w: %w", ErrInvalidToken, err)
	}
}
