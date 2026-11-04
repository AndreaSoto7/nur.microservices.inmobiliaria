package middleware

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/problem"
)

var okHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
})

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

func TestChainRunsInOrderAndAnyLinkCanCut(t *testing.T) {
	var calls []string
	link := func(name string, cut bool) Middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls = append(calls, name)
				if !cut {
					next.ServeHTTP(w, r)
				}
			})
		}
	}

	handler := Chain(okHandler, link("a", false), link("b", true), link("c", false))
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	if got := strings.Join(calls, ","); got != "a,b" {
		t.Errorf("orden = %q, want a,b", got)
	}
}

func TestRecoverTurnsPanicIntoProblem(t *testing.T) {
	rec := httptest.NewRecorder()
	rec.Header().Set(problem.CorrelationHeader, "abc")
	handler := Recover(discardLogger())(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("se rompió")
	}))

	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["code"] != "INTERNAL_ERROR" || body["correlationId"] != "abc" {
		t.Errorf("body = %v", body)
	}
	if strings.Contains(rec.Body.String(), "se rompió") {
		t.Error("el body expone el mensaje del panic")
	}
}

// El reverse proxy usa http.ErrAbortHandler para cortar una respuesta a medias: no es un error
// nuestro, y net/http necesita ver ese panic para cerrar la conexión.
func TestRecoverLetsAbortHandlerThrough(t *testing.T) {
	handler := Recover(discardLogger())(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic(http.ErrAbortHandler)
	}))

	defer func() {
		if p := recover(); !errors.Is(asError(p), http.ErrAbortHandler) {
			t.Errorf("panic = %v, want http.ErrAbortHandler", p)
		}
	}()
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/x", nil))
	t.Error("el panic no se propagó")
}

// Con los headers ya enviados no se puede responder 500: un problem+json se pegaría al body a medias.
func TestRecoverAbortsWhenResponseAlreadyStarted(t *testing.T) {
	handler := Recover(discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("parcial"))
		panic("se rompió a medias")
	}))
	rec := httptest.NewRecorder()

	defer func() {
		if p := recover(); !errors.Is(asError(p), http.ErrAbortHandler) {
			t.Errorf("panic = %v, want http.ErrAbortHandler", p)
		}
		if rec.Body.String() != "parcial" {
			t.Errorf("body = %q", rec.Body.String())
		}
	}()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
}

func asError(p any) error {
	err, _ := p.(error)
	return err
}

func TestCorrelationID(t *testing.T) {
	uuidPattern := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

	tests := []struct {
		name     string
		incoming string
		keep     bool
	}{
		{"conserva uno válido", "abc.DEF_123-x", true},
		{"genera si no llega", "", false},
		{"genera si tiene caracteres inválidos", "abc def", false},
		{"genera si intenta inyectar un log", "abc\",\"admin\":\"true", false},
		{"genera si supera 128 caracteres", strings.Repeat("a", 129), false},
		{"acepta exactamente 128", strings.Repeat("a", 128), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var forwarded string
			handler := CorrelationID(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				forwarded = r.Header.Get(problem.CorrelationHeader)
			}))
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.incoming != "" {
				req.Header.Set(problem.CorrelationHeader, tt.incoming)
			}
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			returned := rec.Header().Get(problem.CorrelationHeader)
			if returned != forwarded {
				t.Errorf("devuelto %q, reenviado %q: deben coincidir", returned, forwarded)
			}
			if tt.keep && returned != tt.incoming {
				t.Errorf("devuelto %q, want %q", returned, tt.incoming)
			}
			if !tt.keep && !uuidPattern.MatchString(returned) {
				t.Errorf("devuelto %q, want un UUID", returned)
			}
		})
	}
}

func TestLoggingRecordsRequestWithoutSensitiveData(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))
	handler := Logging(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		SetUpstream(r.Context(), "10.0.0.5:8001")
		w.WriteHeader(http.StatusCreated)
	}))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login?token=secreto-query", strings.NewReader("password=secreto-body"))
	req.RemoteAddr = "203.0.113.9:4000"
	req.Header.Set("Authorization", "Bearer secreto-header")
	req.Header.Set(problem.CorrelationHeader, "abc")

	handler.ServeHTTP(httptest.NewRecorder(), req)

	line := buf.String()
	var entry map[string]any
	if err := json.Unmarshal([]byte(line), &entry); err != nil {
		t.Fatalf("el log no es JSON: %v (%s)", err, line)
	}
	want := map[string]any{
		"method":        "POST",
		"path":          "/api/v1/auth/login",
		"status":        float64(201),
		"correlationId": "abc",
		"upstream":      "10.0.0.5:8001",
	}
	for key, value := range want {
		if entry[key] != value {
			t.Errorf("%s = %v, want %v", key, entry[key], value)
		}
	}
	if _, ok := entry["durationMs"]; !ok {
		t.Error("falta durationMs")
	}
	for _, secret := range []string{"secreto", "203.0.113.9"} {
		if strings.Contains(line, secret) {
			t.Errorf("el log contiene %q: %s", secret, line)
		}
	}
}

func TestLoggingRecordsPanicAsServerError(t *testing.T) {
	var buf bytes.Buffer
	handler := Logging(slog.New(slog.NewJSONHandler(&buf, nil)))(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("se rompió")
	}))

	func() {
		defer func() { _ = recover() }()
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/x", nil))
	}()

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("el log no es JSON: %v", err)
	}
	if entry["status"] != float64(500) {
		t.Errorf("status = %v", entry["status"])
	}
}

func TestSetUpstreamWithoutLoggingDoesNotFail(t *testing.T) {
	SetUpstream(httptest.NewRequest(http.MethodGet, "/", nil).Context(), "10.0.0.5:8001")
}

// El ReverseProxy necesita Flush y SetReadDeadline, que se alcanzan por Unwrap.
func TestRecorderExposesUnderlyingWriter(t *testing.T) {
	rec := httptest.NewRecorder()
	var flushErr error
	handler := Logging(discardLogger())(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		flushErr = http.NewResponseController(w).Flush()
	}))

	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if flushErr != nil {
		t.Errorf("Flush() error = %v", flushErr)
	}
}

func TestStripIdentityHeaders(t *testing.T) {
	var got http.Header
	handler := StripIdentityHeaders(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		got = r.Header.Clone()
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-User-Id", "falso")
	req.Header.Set("X-User-Roles", "ADMIN")
	// WSGI convierte "_" en "-": para Django, X_User_Id sería el mismo header.
	req.Header["X_user_id"] = []string{"falso"}
	req.Header["x-user-email"] = []string{"falso"}
	req.Header.Set("X-Username-Hint", "se-queda")
	req.Header.Set("Authorization", "Bearer intacto")

	handler.ServeHTTP(httptest.NewRecorder(), req)

	for _, key := range []string{"X-User-Id", "X-User-Roles", "X_user_id", "x-user-email"} {
		if _, ok := got[key]; ok {
			t.Errorf("%s llegó al servicio", key)
		}
	}
	if got.Get("Authorization") != "Bearer intacto" {
		t.Errorf("Authorization = %q", got.Get("Authorization"))
	}
	if got.Get("X-Username-Hint") != "se-queda" {
		t.Error("borró un header que no es X-User-*")
	}
}
