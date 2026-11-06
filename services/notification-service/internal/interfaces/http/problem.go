// Package httpapi expone el servicio por HTTP: rutas, middlewares y errores problem+json.
package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
)

const typeBaseURL = "https://inmobiliaria.local/problems/"

// problem describe un error de la API. detail es fijo: nunca lleva detalles internos.
type problem struct {
	Status int
	Code   string
	Title  string
	Detail string
}

var (
	problemNotFound = problem{http.StatusNotFound, "NOT_FOUND", "No encontrado", "El recurso solicitado no existe."}
	problemInternal = problem{http.StatusInternalServerError, "INTERNAL_ERROR", "Error interno", "Ocurrió un error inesperado."}
)

type fieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type problemBody struct {
	Type          string       `json:"type"`
	Title         string       `json:"title"`
	Status        int          `json:"status"`
	Detail        string       `json:"detail"`
	Instance      string       `json:"instance"`
	Code          string       `json:"code"`
	CorrelationID string       `json:"correlationId"`
	Errors        []fieldError `json:"errors,omitempty"`
}

func writeProblem(w http.ResponseWriter, r *http.Request, p problem, fields ...fieldError) {
	payload, err := json.Marshal(problemBody{
		Type:          typeBaseURL + strings.ReplaceAll(strings.ToLower(p.Code), "_", "-"),
		Title:         p.Title,
		Status:        p.Status,
		Detail:        p.Detail,
		Instance:      r.URL.Path,
		Code:          p.Code,
		CorrelationID: w.Header().Get(CorrelationHeader),
		Errors:        fields,
	})
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(p.Status)
	_, _ = w.Write(payload)
}
