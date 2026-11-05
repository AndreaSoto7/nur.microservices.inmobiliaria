package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/discovery"
)

const (
	testKid      = "clave-1"
	testIssuer   = "identity-service"
	testAudience = "inmobiliaria"
)

var (
	signingKey = mustGenerateKey()
	otherKey   = mustGenerateKey()
	testNow    = time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
)

func mustGenerateKey() *rsa.PrivateKey {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic(err)
	}
	return key
}

func jwkFor(kid string, key *rsa.PublicKey) map[string]string {
	return map[string]string{
		"kty": "RSA",
		"use": "sig",
		"alg": "RS256",
		"kid": kid,
		"n":   base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
		"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
	}
}

// fakeIdentity sirve el JWKS y cuenta cuántas veces se lo piden.
type fakeIdentity struct {
	server *httptest.Server
	hits   atomic.Int64
	status atomic.Int64
	mu     sync.Mutex
	keys   []map[string]string
	gate   atomic.Pointer[chan struct{}]
}

func newFakeIdentity(t *testing.T, keys ...map[string]string) *fakeIdentity {
	t.Helper()
	fake := &fakeIdentity{keys: keys}
	fake.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fake.hits.Add(1)
		if gate := fake.gate.Load(); gate != nil {
			<-*gate
		}
		if r.URL.Path != JWKSPath {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if status := fake.status.Load(); status != 0 {
			w.WriteHeader(int(status))
			return
		}
		fake.mu.Lock()
		defer fake.mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": fake.keys})
	}))
	t.Cleanup(fake.server.Close)
	return fake
}

func (f *fakeIdentity) setKeys(keys ...map[string]string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.keys = keys
}

func (f *fakeIdentity) Pick(string) (discovery.Instance, bool) {
	return discovery.Instance{Address: strings.TrimPrefix(f.server.URL, "http://")}, true
}

type noInstances struct{}

func (noInstances) Pick(string) (discovery.Instance, bool) { return discovery.Instance{}, false }

// clock es un reloj de test seguro ante concurrencia.
type clock struct {
	nanos atomic.Int64
}

func newClock() *clock {
	c := &clock{}
	c.nanos.Store(testNow.UnixNano())
	return c
}

func (c *clock) Now() time.Time          { return time.Unix(0, c.nanos.Load()).UTC() }
func (c *clock) Advance(d time.Duration) { c.nanos.Add(int64(d)) }

func newValidator(picker Picker, c *clock) *Validator {
	return NewValidator(NewKeySet(picker, c.Now), testIssuer, testAudience, c.Now)
}

func validClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"sub": "6f1c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01",
		"iss": testIssuer,
		"aud": testAudience,
		"iat": testNow.Unix(),
		"exp": testNow.Add(15 * time.Minute).Unix(),
	}
}

func sign(t *testing.T, claims jwt.MapClaims, mutate func(*jwt.Token), key any) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["typ"] = "at+jwt"
	token.Header["kid"] = testKid
	if mutate != nil {
		mutate(token)
	}
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return signed
}

func TestValidTokenPasses(t *testing.T) {
	fake := newFakeIdentity(t, jwkFor(testKid, &signingKey.PublicKey))
	validator := newValidator(fake, newClock())

	if err := validator.Validate(context.Background(), sign(t, validClaims(), nil, signingKey)); err != nil {
		t.Errorf("Validate() error = %v", err)
	}
}

func TestInvalidTokensAreRejected(t *testing.T) {
	withClaim := func(key string, value any) jwt.MapClaims {
		claims := validClaims()
		claims[key] = value
		return claims
	}
	withoutClaim := func(key string) jwt.MapClaims {
		claims := validClaims()
		delete(claims, key)
		return claims
	}
	publicKeyBytes := signingKey.N.Bytes()

	tests := []struct {
		name  string
		token func(t *testing.T) string
	}{
		{"vacío", func(*testing.T) string { return "" }},
		{"no es un JWT", func(*testing.T) string { return "abc.def.ghi" }},
		{"vencido", func(t *testing.T) string {
			return sign(t, withClaim("exp", testNow.Add(-time.Second).Unix()), nil, signingKey)
		}},
		{"sin exp", func(t *testing.T) string { return sign(t, withoutClaim("exp"), nil, signingKey) }},
		{"otro issuer", func(t *testing.T) string { return sign(t, withClaim("iss", "otro"), nil, signingKey) }},
		{"sin issuer", func(t *testing.T) string { return sign(t, withoutClaim("iss"), nil, signingKey) }},
		{"otra audiencia", func(t *testing.T) string {
			return sign(t, withClaim("aud", "identity-service"), nil, signingKey)
		}},
		{"sin audiencia", func(t *testing.T) string { return sign(t, withoutClaim("aud"), nil, signingKey) }},
		{"refresh token", func(t *testing.T) string {
			return sign(t, validClaims(), func(token *jwt.Token) { token.Header["typ"] = "rt+jwt" }, signingKey)
		}},
		{"sin typ", func(t *testing.T) string {
			return sign(t, validClaims(), func(token *jwt.Token) { delete(token.Header, "typ") }, signingKey)
		}},
		{"typ JWT común", func(t *testing.T) string {
			return sign(t, validClaims(), func(token *jwt.Token) { token.Header["typ"] = "JWT" }, signingKey)
		}},
		{"firmado con otra clave", func(t *testing.T) string { return sign(t, validClaims(), nil, otherKey) }},
		{"sin kid", func(t *testing.T) string {
			return sign(t, validClaims(), func(token *jwt.Token) { delete(token.Header, "kid") }, signingKey)
		}},
		{"kid desconocido", func(t *testing.T) string {
			return sign(t, validClaims(), func(token *jwt.Token) { token.Header["kid"] = "otra" }, signingKey)
		}},
		{"kid que no es string", func(t *testing.T) string {
			return sign(t, validClaims(), func(token *jwt.Token) { token.Header["kid"] = 7 }, signingKey)
		}},
		{"alg none", func(t *testing.T) string {
			token := jwt.NewWithClaims(jwt.SigningMethodNone, validClaims())
			token.Header["typ"] = "at+jwt"
			token.Header["kid"] = testKid
			signed, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
			if err != nil {
				t.Fatal(err)
			}
			return signed
		}},
		{"HS256 firmado con la clave pública", func(t *testing.T) string {
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, validClaims())
			token.Header["typ"] = "at+jwt"
			token.Header["kid"] = testKid
			signed, err := token.SignedString(publicKeyBytes)
			if err != nil {
				t.Fatal(err)
			}
			return signed
		}},
		{"payload alterado", func(t *testing.T) string {
			parts := strings.Split(sign(t, validClaims(), nil, signingKey), ".")
			forged := sign(t, withClaim("sub", "otro-usuario"), nil, otherKey)
			parts[1] = strings.Split(forged, ".")[1]
			return strings.Join(parts, ".")
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := newFakeIdentity(t, jwkFor(testKid, &signingKey.PublicKey))
			validator := newValidator(fake, newClock())

			err := validator.Validate(context.Background(), tt.token(t))

			if !errors.Is(err, ErrInvalidToken) {
				t.Errorf("Validate() error = %v, want ErrInvalidToken", err)
			}
		})
	}
}

// Un token no debe costar más de una descarga del JWKS mientras la clave sea conocida.
func TestKnownKeyIsCached(t *testing.T) {
	fake := newFakeIdentity(t, jwkFor(testKid, &signingKey.PublicKey))
	validator := newValidator(fake, newClock())
	token := sign(t, validClaims(), nil, signingKey)

	for range 5 {
		if err := validator.Validate(context.Background(), token); err != nil {
			t.Fatal(err)
		}
	}

	if got := fake.hits.Load(); got != 1 {
		t.Errorf("descargas = %d, want 1", got)
	}
}

func randomKidToken(t *testing.T, i int) string {
	t.Helper()
	return sign(t, validClaims(), func(token *jwt.Token) {
		token.Header["kid"] = fmt.Sprintf("kid-al-azar-%d", i)
	}, signingKey)
}

// Sin este freno, cada request con un kid inventado sería una llamada a identity.
func TestRandomKidsCauseOnlyOneReload(t *testing.T) {
	fake := newFakeIdentity(t, jwkFor(testKid, &signingKey.PublicKey))
	c := newClock()
	validator := newValidator(fake, c)
	if err := validator.Validate(context.Background(), sign(t, validClaims(), nil, signingKey)); err != nil {
		t.Fatal(err)
	}
	c.Advance(ReloadInterval)
	fake.hits.Store(0)

	for i := range 20 {
		if err := validator.Validate(context.Background(), randomKidToken(t, i)); !errors.Is(err, ErrInvalidToken) {
			t.Fatalf("Validate() error = %v", err)
		}
	}

	if got := fake.hits.Load(); got != 1 {
		t.Errorf("descargas = %d, want 1", got)
	}
}

func TestConcurrentRandomKidsShareOneReload(t *testing.T) {
	fake := newFakeIdentity(t, jwkFor(testKid, &signingKey.PublicKey))
	gate := make(chan struct{})
	fake.gate.Store(&gate)
	validator := newValidator(fake, newClock())
	var wg sync.WaitGroup
	tokens := make([]string, 20)
	for i := range tokens {
		tokens[i] = randomKidToken(t, i)
	}

	for _, token := range tokens {
		wg.Go(func() { _ = validator.Validate(context.Background(), token) })
	}
	time.Sleep(50 * time.Millisecond)
	close(gate)
	wg.Wait()

	if got := fake.hits.Load(); got != 1 {
		t.Errorf("descargas = %d, want 1", got)
	}
}

// Rotación de clave: un kid nuevo se encuentra recargando, una vez vencido el freno.
func TestRotatedKeyIsFoundAfterReloadInterval(t *testing.T) {
	fake := newFakeIdentity(t, jwkFor(testKid, &signingKey.PublicKey))
	c := newClock()
	validator := newValidator(fake, c)
	if err := validator.Validate(context.Background(), sign(t, validClaims(), nil, signingKey)); err != nil {
		t.Fatal(err)
	}
	fake.setKeys(jwkFor("clave-2", &otherKey.PublicKey))
	rotated := sign(t, validClaims(), func(token *jwt.Token) { token.Header["kid"] = "clave-2" }, otherKey)

	if err := validator.Validate(context.Background(), rotated); !errors.Is(err, ErrInvalidToken) {
		t.Errorf("dentro del freno: error = %v, want ErrInvalidToken", err)
	}

	c.Advance(ReloadInterval)

	if err := validator.Validate(context.Background(), rotated); err != nil {
		t.Errorf("tras el freno: error = %v", err)
	}
}

// Si no se puede descargar el JWKS no se sabe si el token es válido: responder 401 haría creer al
// cliente que su sesión venció, y eso es distinto a que identity esté caído.
func TestUnavailableKeysAreNotReportedAsInvalidToken(t *testing.T) {
	tests := []struct {
		name  string
		setup func(t *testing.T) Picker
	}{
		{"sin réplicas de identity", func(*testing.T) Picker { return noInstances{} }},
		{"identity responde 500", func(t *testing.T) Picker {
			fake := newFakeIdentity(t)
			fake.status.Store(http.StatusInternalServerError)
			return fake
		}},
		{"JWKS vacío", func(t *testing.T) Picker { return newFakeIdentity(t) }},
		{"réplica que no responde", func(t *testing.T) Picker {
			fake := newFakeIdentity(t)
			fake.server.Close()
			return fake
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			validator := newValidator(tt.setup(t), newClock())

			err := validator.Validate(context.Background(), sign(t, validClaims(), nil, signingKey))

			if !errors.Is(err, ErrKeysUnavailable) {
				t.Errorf("Validate() error = %v, want ErrKeysUnavailable", err)
			}
		})
	}
}

func TestKnownKeyKeepsWorkingWhenIdentityGoesDown(t *testing.T) {
	fake := newFakeIdentity(t, jwkFor(testKid, &signingKey.PublicKey))
	c := newClock()
	validator := newValidator(fake, c)
	token := sign(t, validClaims(), nil, signingKey)
	if err := validator.Validate(context.Background(), token); err != nil {
		t.Fatal(err)
	}

	fake.status.Store(http.StatusInternalServerError)
	c.Advance(ReloadInterval)

	if err := validator.Validate(context.Background(), token); err != nil {
		t.Errorf("una clave en caché debe seguir sirviendo: %v", err)
	}
}

// Sin ninguna clave todavía, esperar 30 s dejaría al gateway inservible aunque identity ya levantó.
func TestColdStartRetriesSoonerThanReloadInterval(t *testing.T) {
	fake := newFakeIdentity(t, jwkFor(testKid, &signingKey.PublicKey))
	fake.status.Store(http.StatusInternalServerError)
	c := newClock()
	validator := newValidator(fake, c)
	token := sign(t, validClaims(), nil, signingKey)
	if err := validator.Validate(context.Background(), token); !errors.Is(err, ErrKeysUnavailable) {
		t.Fatalf("Validate() error = %v", err)
	}
	fake.status.Store(0)

	if err := validator.Validate(context.Background(), token); !errors.Is(err, ErrKeysUnavailable) {
		t.Errorf("dentro del freno de arranque: error = %v", err)
	}

	c.Advance(ColdStartRetryInterval)

	if err := validator.Validate(context.Background(), token); err != nil {
		t.Errorf("tras el freno de arranque: error = %v", err)
	}
}

func TestUnusableKeysAreIgnored(t *testing.T) {
	smallKey, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name string
		key  map[string]string
	}{
		{"clave de 1024 bits", jwkFor(testKid, &smallKey.PublicKey)},
		{"otro kty", func() map[string]string {
			key := jwkFor(testKid, &signingKey.PublicKey)
			key["kty"] = "EC"
			return key
		}()},
		{"otro alg", func() map[string]string {
			key := jwkFor(testKid, &signingKey.PublicKey)
			key["alg"] = "HS256"
			return key
		}()},
		{"para cifrar", func() map[string]string {
			key := jwkFor(testKid, &signingKey.PublicKey)
			key["use"] = "enc"
			return key
		}()},
		{"n ilegible", func() map[string]string {
			key := jwkFor(testKid, &signingKey.PublicKey)
			key["n"] = "***"
			return key
		}()},
		{"e par", func() map[string]string {
			key := jwkFor(testKid, &signingKey.PublicKey)
			key["e"] = "Ag"
			return key
		}()},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := newFakeIdentity(t, tt.key)
			validator := newValidator(fake, newClock())

			err := validator.Validate(context.Background(), sign(t, validClaims(), nil, signingKey))

			if err == nil {
				t.Error("aceptó un token verificado con una clave inutilizable")
			}
		})
	}
}
