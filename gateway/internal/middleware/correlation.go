package middleware

import (
	"net/http"
	"regexp"

	"github.com/google/uuid"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/problem"
)

var correlationIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,128}$`)

// CorrelationID asegura un id válido, lo reenvía al servicio y lo devuelve en la respuesta.
// El valor viene del cliente y termina en logs: por eso se valida y no se copia tal cual.
func CorrelationID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(problem.CorrelationHeader)
		if !correlationIDPattern.MatchString(id) {
			id = uuid.NewString()
		}
		r.Header.Set(problem.CorrelationHeader, id)
		w.Header().Set(problem.CorrelationHeader, id)
		next.ServeHTTP(w, r)
	})
}
