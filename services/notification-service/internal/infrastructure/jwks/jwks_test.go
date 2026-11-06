package jwks

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	testKid  = "clave-1"
	issuer   = "identity-service"
	audience = "inmobiliaria"
	userID   = "6f1c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01"
)

var (
	signingKey = mustKey()
	otherKey   = mustKey()
	testNow    = time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC)
)

func mustKey() *rsa.PrivateKey {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic(err)
	}
	return key
}

func publicJWK(kid string, key *rsa.PublicKey) map[string]string {
	return map[string]string{
		"kty": "RSA", "use": "sig", "alg": "RS256", "kid": kid,
		"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
		"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
	}
}

type fakeIdentity struct {
	server *httptest.Server
	hits   atomic.Int64
	status atomic.Int64
	mu     sync.Mutex
	keys   []map[string]string
}

func newFakeIdentity(t *testing.T, keys ...map[string]string) *fakeIdentity {
	t.Helper()
	fake := &fakeIdentity{keys: keys}
	fake.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fake.hits.Add(1)
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

type clock struct{ nanos atomic.Int64 }

func newClock() *clock {
	c := &clock{}
	c.nanos.Store(testNow.UnixNano())
	return c
}

func (c *clock) Now() time.Time          { return time.Unix(0, c.nanos.Load()).UTC() }
func (c *clock) Advance(d time.Duration) { c.nanos.Add(int64(d)) }

func newValidator(fake *fakeIdentity, c *clock) (*Validator, *KeySet) {
	keys := NewKeySet(fake.server.URL, c.Now)
	return NewValidator(keys, issuer, audience, c.Now), keys
}

func claims() jwt.MapClaims {
	return jwt.MapClaims{
		"sub": userID, "iss": issuer, "aud": audience, "iat": testNow.Unix(), "exp": testNow.Add(15 * time.Minute).Unix(),
	}
}

func sign(t *testing.T, values jwt.MapClaims, mutate func(*jwt.Token), key any) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, values)
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

func TestValidTokenReturnsTheUser(t *testing.T) {
	validator, _ := newValidator(newFakeIdentity(t, publicJWK(testKid, &signingKey.PublicKey)), newClock())

	got, err := validator.Validate(context.Background(), sign(t, claims(), nil, signingKey))
	if err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	if got != userID {
		t.Errorf("usuario = %q", got)
	}
}

func TestInvalidTokensAreRejected(t *testing.T) {
	with := func(key string, value any) jwt.MapClaims {
		values := claims()
		values[key] = value
		return values
	}
	without := func(key string) jwt.MapClaims {
		values := claims()
		delete(values, key)
		return values
	}
	tests := []struct {
		name  string
		token func(t *testing.T) string
	}{
		{"no es un JWT", func(*testing.T) string { return "abc.def.ghi" }},
		{"vencido", func(t *testing.T) string {
			return sign(t, with("exp", testNow.Add(-time.Second).Unix()), nil, signingKey)
		}},
		{"sin exp", func(t *testing.T) string { return sign(t, without("exp"), nil, signingKey) }},
		{"otro issuer", func(t *testing.T) string { return sign(t, with("iss", "otro"), nil, signingKey) }},
		{"otra audiencia", func(t *testing.T) string { return sign(t, with("aud", "identity-service"), nil, signingKey) }},
		{"sin sub", func(t *testing.T) string { return sign(t, without("sub"), nil, signingKey) }},
		{"sub que no es UUID", func(t *testing.T) string { return sign(t, with("sub", "abc"), nil, signingKey) }},
		{"refresh token", func(t *testing.T) string {
			return sign(t, claims(), func(token *jwt.Token) { token.Header["typ"] = "rt+jwt" }, signingKey)
		}},
		{"sin typ", func(t *testing.T) string {
			return sign(t, claims(), func(token *jwt.Token) { delete(token.Header, "typ") }, signingKey)
		}},
		{"firmado con otra clave", func(t *testing.T) string { return sign(t, claims(), nil, otherKey) }},
		{"kid desconocido", func(t *testing.T) string {
			return sign(t, claims(), func(token *jwt.Token) { token.Header["kid"] = "otra" }, signingKey)
		}},
		{"sin kid", func(t *testing.T) string {
			return sign(t, claims(), func(token *jwt.Token) { delete(token.Header, "kid") }, signingKey)
		}},
		{"alg none", func(t *testing.T) string {
			token := jwt.NewWithClaims(jwt.SigningMethodNone, claims())
			token.Header["typ"] = "at+jwt"
			token.Header["kid"] = testKid
			signed, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
			if err != nil {
				t.Fatal(err)
			}
			return signed
		}},
		{"HS256 firmado con la clave pública", func(t *testing.T) string {
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims())
			token.Header["typ"] = "at+jwt"
			token.Header["kid"] = testKid
			signed, err := token.SignedString(signingKey.N.Bytes())
			if err != nil {
				t.Fatal(err)
			}
			return signed
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			validator, _ := newValidator(newFakeIdentity(t, publicJWK(testKid, &signingKey.PublicKey)), newClock())

			_, err := validator.Validate(context.Background(), tt.token(t))

			if !errors.Is(err, ErrInvalidToken) {
				t.Errorf("error = %v, want ErrInvalidToken", err)
			}
		})
	}
}

// Sin este freno, cada request con un kid inventado sería una llamada a identity.
func TestRandomKidsCauseOnlyOneReload(t *testing.T) {
	fake := newFakeIdentity(t, publicJWK(testKid, &signingKey.PublicKey))
	c := newClock()
	validator, _ := newValidator(fake, c)
	if _, err := validator.Validate(context.Background(), sign(t, claims(), nil, signingKey)); err != nil {
		t.Fatal(err)
	}
	c.Advance(ReloadInterval)
	fake.hits.Store(0)

	for i := range 10 {
		token := sign(t, claims(), func(token *jwt.Token) { token.Header["kid"] = "kid-" + string(rune('a'+i)) }, signingKey)
		_, _ = validator.Validate(context.Background(), token)
	}

	if got := fake.hits.Load(); got != 1 {
		t.Errorf("descargas = %d, want 1", got)
	}
}

func TestUnavailableKeysAreNotAnInvalidToken(t *testing.T) {
	fake := newFakeIdentity(t)
	fake.status.Store(http.StatusInternalServerError)
	validator, _ := newValidator(fake, newClock())

	_, err := validator.Validate(context.Background(), sign(t, claims(), nil, signingKey))

	if !errors.Is(err, ErrKeysUnavailable) {
		t.Errorf("error = %v, want ErrKeysUnavailable", err)
	}
}

func TestColdStartRetriesSooner(t *testing.T) {
	fake := newFakeIdentity(t, publicJWK(testKid, &signingKey.PublicKey))
	fake.status.Store(http.StatusInternalServerError)
	c := newClock()
	validator, _ := newValidator(fake, c)
	token := sign(t, claims(), nil, signingKey)
	_, _ = validator.Validate(context.Background(), token)
	fake.status.Store(0)

	c.Advance(ColdStartRetryInterval)

	if _, err := validator.Validate(context.Background(), token); err != nil {
		t.Errorf("error = %v", err)
	}
}

func TestWeakOrForeignKeysAreIgnored(t *testing.T) {
	small, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatal(err)
	}
	foreign := publicJWK(testKid, &signingKey.PublicKey)
	foreign["alg"] = "HS256"
	validator, _ := newValidator(newFakeIdentity(t, publicJWK(testKid, &small.PublicKey), foreign), newClock())

	if _, err := validator.Validate(context.Background(), sign(t, claims(), nil, signingKey)); err == nil {
		t.Error("aceptó una clave inutilizable")
	}
}

func TestRefreshDropsRetiredKeyAndSurvivesFailures(t *testing.T) {
	fake := newFakeIdentity(t, publicJWK(testKid, &signingKey.PublicKey))
	validator, keys := newValidator(fake, newClock())
	token := sign(t, claims(), nil, signingKey)
	if _, err := validator.Validate(context.Background(), token); err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.DiscardHandler)

	fake.status.Store(http.StatusInternalServerError)
	keys.refresh(context.Background(), logger)
	if _, err := validator.Validate(context.Background(), token); err != nil {
		t.Errorf("con identity caído: error = %v", err)
	}

	fake.status.Store(0)
	fake.setKeys(publicJWK("clave-2", &otherKey.PublicKey))
	keys.refresh(context.Background(), logger)
	if _, err := validator.Validate(context.Background(), token); !errors.Is(err, ErrInvalidToken) {
		t.Errorf("clave retirada: error = %v", err)
	}
}

func TestRunStopsWithContext(t *testing.T) {
	fake := newFakeIdentity(t, publicJWK(testKid, &signingKey.PublicKey))
	_, keys := newValidator(fake, newClock())
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		keys.Run(ctx, time.Millisecond, slog.New(slog.DiscardHandler))
		close(done)
	}()
	deadline := time.After(5 * time.Second)
	for fake.hits.Load() < 2 {
		select {
		case <-deadline:
			t.Fatal("no repitió la descarga")
		case <-time.After(time.Millisecond):
		}
	}

	cancel()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run no terminó")
	}
}
