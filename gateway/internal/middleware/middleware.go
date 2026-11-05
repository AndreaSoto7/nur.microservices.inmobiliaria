// Package middleware contiene los eslabones de la cadena del gateway (Chain of Responsibility):
// cada uno recibe un handler y devuelve otro, y puede cortar la request o pasarla al siguiente.
package middleware

import "net/http"

// Middleware es un eslabón de la cadena.
type Middleware func(http.Handler) http.Handler

// Chain arma la cadena: el primer middleware es el primero que recibe la request.
func Chain(final http.Handler, links ...Middleware) http.Handler {
	handler := final
	for i := len(links) - 1; i >= 0; i-- {
		handler = links[i](handler)
	}
	return handler
}

// responseRecorder recuerda el status escrito. Unwrap permite que http.ResponseController llegue
// al writer real: el reverse proxy lo usa para Flush y para ajustar los deadlines.
type responseRecorder struct {
	http.ResponseWriter
	status int
}

func (r *responseRecorder) WriteHeader(status int) {
	// Un 1xx no es la respuesta final: después de él todavía viene el status real.
	if r.status == 0 && status >= http.StatusOK {
		r.status = status
	}
	r.ResponseWriter.WriteHeader(status)
}

func (r *responseRecorder) Write(data []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	return r.ResponseWriter.Write(data)
}

func (r *responseRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}
