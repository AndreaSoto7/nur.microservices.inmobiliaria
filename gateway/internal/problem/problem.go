// Package problem escribe las respuestas de error del propio gateway (RFC 9457).
package problem

import (
	"encoding/json"
	"net/http"
	"strings"
)

// CorrelationHeader lleva el id de trazabilidad de cada request.
const CorrelationHeader = "X-Correlation-Id"

const typeBaseURL = "https://inmobiliaria.local/problems/"

// Kind describe un error del gateway. Detail es fijo: nunca lleva direcciones internas ni err.Error().
type Kind struct {
	Status int
	Code   string
	Title  string
	Detail string
}

// Errores del gateway, según la tabla "Errores propios" de gateway/CLAUDE.md.
var (
	BadRequest = Kind{http.StatusBadRequest, "GATEWAY_BAD_REQUEST",
		"Petición inválida", "La ruta o el cuerpo de la petición no son válidos."}
	Unauthorized = Kind{http.StatusUnauthorized, "GATEWAY_UNAUTHORIZED",
		"No autorizado", "Falta el token de acceso o no es válido."}
	RouteNotFound = Kind{http.StatusNotFound, "GATEWAY_ROUTE_NOT_FOUND",
		"Ruta no encontrada", "La ruta solicitada no existe."}
	PayloadTooLarge = Kind{http.StatusRequestEntityTooLarge, "GATEWAY_PAYLOAD_TOO_LARGE",
		"Cuerpo demasiado grande", "El cuerpo de la petición supera el límite permitido."}
	RateLimited = Kind{http.StatusTooManyRequests, "GATEWAY_RATE_LIMITED",
		"Demasiadas peticiones", "Espera un momento antes de volver a intentar."}
	Internal = Kind{http.StatusInternalServerError, "INTERNAL_ERROR",
		"Error interno", "Ocurrió un error inesperado."}
	UpstreamError = Kind{http.StatusBadGateway, "GATEWAY_UPSTREAM_ERROR",
		"Error del servicio", "No se pudo comunicar con el servicio."}
	NoHealthyInstance = Kind{http.StatusServiceUnavailable, "GATEWAY_NO_HEALTHY_INSTANCE",
		"Servicio no disponible", "El servicio no está disponible en este momento."}
	UpstreamTimeout = Kind{http.StatusGatewayTimeout, "GATEWAY_UPSTREAM_TIMEOUT",
		"Tiempo de espera agotado", "El servicio no respondió a tiempo."}
)

type body struct {
	Type          string `json:"type"`
	Title         string `json:"title"`
	Status        int    `json:"status"`
	Detail        string `json:"detail"`
	Instance      string `json:"instance"`
	Code          string `json:"code"`
	CorrelationID string `json:"correlationId"`
}

// Write responde el error. Toma el correlationId del header de respuesta, que el middleware de
// correlation-id ya fijó: así este paquete no depende de la cadena de middlewares.
func Write(w http.ResponseWriter, r *http.Request, kind Kind) {
	payload, err := json.Marshal(body{
		Type:          typeBaseURL + strings.ReplaceAll(strings.ToLower(kind.Code), "_", "-"),
		Title:         kind.Title,
		Status:        kind.Status,
		Detail:        kind.Detail,
		Instance:      r.URL.Path,
		Code:          kind.Code,
		CorrelationID: w.Header().Get(CorrelationHeader),
	})
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(kind.Status)
	// Si el cliente ya se fue no hay a quién avisarle.
	_, _ = w.Write(payload)
}
