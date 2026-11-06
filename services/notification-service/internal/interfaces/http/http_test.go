package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

func newTestRouter(ready ReadinessCheck) http.Handler {
	return NewRouter(Dependencies{Logger: slog.New(slog.DiscardHandler), Ready: ready})
}

func alwaysReady(context.Context) error { return nil }

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body no es JSON: %v (%s)", err, rec.Body.String())
	}
	return body
}

func TestHealthDoesNotDependOnTheDatabase(t *testing.T) {
	rec := httptest.NewRecorder()
	failing := func(context.Context) error { return errors.New("base caída") }

	newTestRouter(failing).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rec.Code != http.StatusOK || decode(t, rec)["status"] != "UP" {
		t.Errorf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestReadinessReportsTheDatabase(t *testing.T) {
	tests := []struct {
		name   string
		ready  ReadinessCheck
		status int
		body   string
	}{
		{"lista", alwaysReady, http.StatusOK, "UP"},
		{"base caída", func(context.Context) error { return errors.New("base caída") }, http.StatusServiceUnavailable, "DOWN"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()

			newTestRouter(tt.ready).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health/ready", nil))

			if rec.Code != tt.status || decode(t, rec)["status"] != tt.body {
				t.Errorf("status = %d, body = %s", rec.Code, rec.Body.String())
			}
			if strings.Contains(rec.Body.String(), "caída") {
				t.Error("el body expone el error interno")
			}
		})
	}
}

func TestUnknownRouteRespondsProblem(t *testing.T) {
	rec := httptest.NewRecorder()

	newTestRouter(alwaysReady).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/no-existe", nil))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/problem+json" {
		t.Errorf("Content-Type = %q", got)
	}
	body := decode(t, rec)
	if body["code"] != "NOT_FOUND" || body["correlationId"] == "" {
		t.Errorf("body = %v", body)
	}
}

func TestCorrelationID(t *testing.T) {
	uuidPattern := regexp.MustCompile(`^[0-9a-f-]{36}$`)
	tests := []struct {
		name, incoming string
		keep           bool
	}{
		{"conserva uno válido", "abc.DEF_123-x", true},
		{"genera si no llega", "", false},
		{"genera si es inválido", "abc def", false},
		{"genera si supera 128", strings.Repeat("a", 129), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/no-existe", nil)
			if tt.incoming != "" {
				req.Header.Set(CorrelationHeader, tt.incoming)
			}
			rec := httptest.NewRecorder()

			newTestRouter(alwaysReady).ServeHTTP(rec, req)

			got := rec.Header().Get(CorrelationHeader)
			if tt.keep && got != tt.incoming {
				t.Errorf("id = %q", got)
			}
			if !tt.keep && !uuidPattern.MatchString(got) {
				t.Errorf("id = %q, want un UUID", got)
			}
		})
	}
}

func TestPanicRespondsInternalErrorWithoutDetails(t *testing.T) {
	handler := withMiddleware(slog.New(slog.DiscardHandler), http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("detalle interno")
	}))
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))

	if rec.Code != http.StatusInternalServerError || decode(t, rec)["code"] != "INTERNAL_ERROR" {
		t.Errorf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "detalle interno") {
		t.Error("el body expone el panic")
	}
}

func TestLogsDoNotIncludeQueryOrAuthorization(t *testing.T) {
	var log strings.Builder
	handler := withMiddleware(slog.New(slog.NewJSONHandler(&log, nil)), http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	req := httptest.NewRequest(http.MethodGet, "/x?token=secreto-query", nil)
	req.Header.Set("Authorization", "Bearer secreto-header")

	handler.ServeHTTP(httptest.NewRecorder(), req)

	if strings.Contains(log.String(), "secreto") {
		t.Errorf("el log contiene un secreto: %s", log.String())
	}
	var entry map[string]any
	if err := json.Unmarshal([]byte(log.String()), &entry); err != nil {
		t.Fatal(err)
	}
	if entry["status"] != float64(201) || entry["path"] != "/x" || entry["correlationId"] == "" {
		t.Errorf("entry = %v", entry)
	}
}
