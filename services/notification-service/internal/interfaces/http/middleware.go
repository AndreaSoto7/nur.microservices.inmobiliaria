package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"runtime/debug"
	"time"

	"github.com/google/uuid"
)

// CorrelationHeader lleva el id de trazabilidad de cada request.
const CorrelationHeader = "X-Correlation-Id"

var correlationIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,128}$`)

// withMiddleware aplica correlation-id, logs y recuperación de panics a toda la API.
func withMiddleware(logger *slog.Logger, next http.Handler) http.Handler {
	return correlationID(logging(logger, recoverPanic(logger, next)))
}

// correlationID valida el id recibido: viene de afuera y termina en los logs.
func correlationID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(CorrelationHeader)
		if !correlationIDPattern.MatchString(id) {
			id = uuid.NewString()
		}
		r.Header.Set(CorrelationHeader, id)
		w.Header().Set(CorrelationHeader, id)
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	if s.status == 0 {
		s.status = status
	}
	s.ResponseWriter.WriteHeader(status)
}

func (s *statusRecorder) Write(data []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	return s.ResponseWriter.Write(data)
}

// logging no registra headers, body, query ni IP: pueden llevar tokens o datos personales.
func logging(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w}
		next.ServeHTTP(rec, r)
		logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"durationMs", time.Since(start).Milliseconds(),
			"correlationId", r.Header.Get(CorrelationHeader))
	})
}

func recoverPanic(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			p := recover()
			if p == nil {
				return
			}
			if err, ok := p.(error); ok && errors.Is(err, http.ErrAbortHandler) {
				panic(p)
			}
			logger.Error("panic atendiendo una request",
				"panic", p,
				"correlationId", r.Header.Get(CorrelationHeader),
				"stack", string(debug.Stack()))
			writeProblem(w, r, problemInternal)
		}()
		next.ServeHTTP(w, r)
	})
}
