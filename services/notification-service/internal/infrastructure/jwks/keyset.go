// Package jwks valida los access tokens con el JWKS de identity.
package jwks

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"sync/atomic"
	"time"

	"golang.org/x/sync/singleflight"
)

const (
	// ReloadInterval es el mínimo entre descargas: sin él, cada request con un kid inventado sería una
	// llamada a identity.
	ReloadInterval = 30 * time.Second
	// RefreshInterval renueva la lista aunque nadie mande un kid desconocido: si no, una clave retirada
	// seguiría valiendo. Son los 5 minutos que el contrato de identity permite cachear el JWKS.
	RefreshInterval = 5 * time.Minute
	// ColdStartRetryInterval se usa mientras no haya ninguna clave: el gateway suele arrancar antes que
	// identity, y esperar 30 s lo dejaría inservible sin motivo.
	ColdStartRetryInterval = 5 * time.Second

	jwksTimeout     = 3 * time.Second
	maxJWKSResponse = 1 << 20
	minRSAKeyBits   = 2048
	minRSAExponent  = 3
)

// ErrUnknownKey indica que el JWKS se pudo consultar, pero no tiene ese kid.
var ErrUnknownKey = errors.New("kid desconocido")

// ErrKeysUnavailable indica que no se pudo descargar el JWKS: no se sabe si el token es válido.
var ErrKeysUnavailable = errors.New("JWKS no disponible")

// KeySet guarda en memoria las claves públicas de identity.
type KeySet struct {
	url   string
	now   func() time.Time
	http  *http.Client
	group singleflight.Group
	keys  atomic.Pointer[map[string]*rsa.PublicKey]

	// Solo se tocan dentro de group.Do, que ejecuta una recarga por vez.
	lastAttempt time.Time
	lastErr     error
}

// NewKeySet recibe el reloj para que los tests no dependan de la hora real.
func NewKeySet(url string, now func() time.Time) *KeySet {
	keySet := &KeySet{
		url: url,
		now: now,
		http: &http.Client{
			Timeout: jwksTimeout,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
	keySet.keys.Store(&map[string]*rsa.PublicKey{})
	return keySet
}

// Key devuelve la clave del kid. Un kid desconocido dispara una recarga, con freno de frecuencia y
// una sola en curso: las requests simultáneas esperan a esa misma descarga.
func (k *KeySet) Key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	if key, ok := (*k.keys.Load())[kid]; ok {
		return key, nil
	}

	_, err, _ := k.group.Do("jwks", func() (any, error) {
		return nil, k.reloadIfAllowed(ctx)
	})

	if key, ok := (*k.keys.Load())[kid]; ok {
		return key, nil
	}
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrKeysUnavailable, err)
	}
	return nil, ErrUnknownKey
}

func (k *KeySet) reloadIfAllowed(ctx context.Context) error {
	now := k.now()
	if !k.lastAttempt.IsZero() && now.Sub(k.lastAttempt) < k.reloadInterval() {
		return k.lastErr
	}
	return k.reload(ctx)
}

func (k *KeySet) reload(ctx context.Context) error {
	k.lastAttempt = k.now()
	keys, err := k.download(ctx)
	k.lastErr = err
	if err != nil {
		return err
	}
	k.keys.Store(&keys)
	return nil
}

// Run renueva las claves cada interval, hasta que se cancele ctx.
func (k *KeySet) Run(ctx context.Context, interval time.Duration, logger *slog.Logger) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			k.refresh(ctx, logger)
		}
	}
}

// refresh comparte la descarga con las recargas por kid desconocido, pero no respeta su freno: es una
// sola por intervalo. Si falla conserva las claves conocidas: sin identity no se sabe cuáles valen, y
// dejar de validar tumbaría todas las rutas protegidas.
func (k *KeySet) refresh(ctx context.Context, logger *slog.Logger) {
	_, err, _ := k.group.Do("jwks", func() (any, error) {
		return nil, k.reload(ctx)
	})
	if err != nil && ctx.Err() == nil {
		logger.Warn("no se pudo renovar el JWKS; se conservan las claves conocidas", "error", err)
	}
}

func (k *KeySet) reloadInterval() time.Duration {
	if len(*k.keys.Load()) == 0 && k.lastErr != nil {
		return ColdStartRetryInterval
	}
	return ReloadInterval
}

func (k *KeySet) download(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	// La descarga la comparten varias requests: que cancele una no debe hacer fallar a las demás.
	req, err := http.NewRequestWithContext(context.WithoutCancel(ctx), http.MethodGet, k.url, nil)
	if err != nil {
		return nil, fmt.Errorf("armar la consulta: %w", err)
	}
	resp, err := k.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("descargar el JWKS: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("descargar el JWKS: status %d", resp.StatusCode)
	}
	var document jwksDocument
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxJWKSResponse)).Decode(&document); err != nil {
		return nil, fmt.Errorf("leer el JWKS: %w", err)
	}
	return document.signingKeys()
}

type jwk struct {
	KeyType   string `json:"kty"`
	Use       string `json:"use"`
	Algorithm string `json:"alg"`
	KeyID     string `json:"kid"`
	Modulus   string `json:"n"`
	Exponent  string `json:"e"`
}

type jwksDocument struct {
	Keys []jwk `json:"keys"`
}

// signingKeys descarta las claves inutilizables. Un JWKS sin ninguna es un error y no reemplaza a las
// claves que ya estaban en memoria.
func (d jwksDocument) signingKeys() (map[string]*rsa.PublicKey, error) {
	keys := make(map[string]*rsa.PublicKey, len(d.Keys))
	for _, candidate := range d.Keys {
		if key, ok := candidate.rsaPublicKey(); ok {
			keys[candidate.KeyID] = key
		}
	}
	if len(keys) == 0 {
		return nil, errors.New("el JWKS no tiene claves de firma RS256 utilizables")
	}
	return keys, nil
}

func (j jwk) rsaPublicKey() (*rsa.PublicKey, bool) {
	if j.KeyID == "" || j.KeyType != "RSA" || (j.Use != "" && j.Use != "sig") ||
		(j.Algorithm != "" && j.Algorithm != "RS256") {
		return nil, false
	}
	modulusBytes, err := base64.RawURLEncoding.DecodeString(j.Modulus)
	if err != nil {
		return nil, false
	}
	exponentBytes, err := base64.RawURLEncoding.DecodeString(j.Exponent)
	if err != nil {
		return nil, false
	}

	modulus := new(big.Int).SetBytes(modulusBytes)
	exponent := new(big.Int).SetBytes(exponentBytes)
	validExponent := exponent.IsInt64() && exponent.Int64() >= minRSAExponent &&
		exponent.Int64() <= 1<<31-1 && exponent.Bit(0) == 1
	if modulus.BitLen() < minRSAKeyBits || !validExponent {
		return nil, false
	}
	return &rsa.PublicKey{N: modulus, E: int(exponent.Int64())}, true
}
