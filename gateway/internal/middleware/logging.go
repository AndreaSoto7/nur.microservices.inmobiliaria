package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/problem"
)

type upstreamKey struct{}

// SetUpstream anota la réplica que atendió la request, para que salga en el log.
func SetUpstream(ctx context.Context, address string) {
	if holder, ok := ctx.Value(upstreamKey{}).(*string); ok {
		*holder = address
	}
}

// Logging registra cada request. No registra headers, body, query ni IP: pueden llevar tokens o
// datos personales.
func Logging(logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &responseRecorder{ResponseWriter: w}
			var upstream string
			ctx := context.WithValue(r.Context(), upstreamKey{}, &upstream)

			finished := false
			defer func() {
				logger.Info("request",
					"method", r.Method,
					"path", r.URL.Path,
					"status", finalStatus(rec.status, finished),
					"durationMs", time.Since(start).Milliseconds(),
					"correlationId", r.Header.Get(problem.CorrelationHeader),
					"upstream", upstream)
			}()
			next.ServeHTTP(rec, r.WithContext(ctx))
			finished = true
		})
	}
}

// finalStatus resuelve el caso sin WriteHeader: net/http responde 200 si el handler terminó bien, y
// si hubo un panic, Recover responde 500 después de este log.
func finalStatus(recorded int, finished bool) int {
	switch {
	case recorded != 0:
		return recorded
	case finished:
		return http.StatusOK
	default:
		return http.StatusInternalServerError
	}
}
