package middleware

import (
	"errors"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/problem"
)

// Recover convierte un panic en un 500 problem+json para que no se pierda la respuesta.
func Recover(logger *slog.Logger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rec := &responseRecorder{ResponseWriter: w}
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
					"correlationId", w.Header().Get(problem.CorrelationHeader),
					"stack", string(debug.Stack()))
				// Con la respuesta empezada, lo único honesto es cortar la conexión.
				if rec.status != 0 {
					panic(http.ErrAbortHandler)
				}
				problem.Write(rec, r, problem.Internal)
			}()
			next.ServeHTTP(rec, r)
		})
	}
}
