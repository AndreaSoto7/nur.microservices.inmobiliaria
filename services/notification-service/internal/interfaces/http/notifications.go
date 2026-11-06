package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/application"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/domain"
)

const (
	defaultPage = 1
	defaultSize = 20
	// El único body de la API es {"read":true}.
	maxBodyBytes = 1 << 10
)

// ListUseCase lista los avisos del usuario.
type ListUseCase interface {
	Handle(ctx context.Context, query application.ListNotificationsQuery) (application.NotificationPage, error)
}

// MarkReadUseCase marca un aviso como leído.
type MarkReadUseCase interface {
	Handle(ctx context.Context, command application.MarkNotificationReadCommand) error
}

type notificationResponse struct {
	ID         string  `json:"id"`
	Type       string  `json:"type"`
	Message    string  `json:"message"`
	PropertyID *string `json:"propertyId"`
	VisitID    *string `json:"visitId"`
	CreatedAt  string  `json:"createdAt"`
	ReadAt     *string `json:"readAt"`
}

type pageMeta struct {
	Number        int `json:"number"`
	Size          int `json:"size"`
	TotalElements int `json:"totalElements"`
	TotalPages    int `json:"totalPages"`
}

type pageResponse struct {
	Data []notificationResponse `json:"data"`
	Page pageMeta               `json:"page"`
}

func listNotifications(deps Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query, invalid := parseListQuery(r)
		if invalid != nil {
			writeProblem(w, r, problemValidation, *invalid)
			return
		}
		query.UserID = userFrom(r.Context())

		page, err := deps.List.Handle(r.Context(), query)
		if err != nil {
			writeInternal(deps, w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, toPageResponse(page))
	}
}

// parseListQuery valida los parámetros. Devuelve el primer campo inválido, para decirle al cliente cuál
// corregir.
func parseListQuery(r *http.Request) (application.ListNotificationsQuery, *fieldError) {
	values := r.URL.Query()
	query := application.ListNotificationsQuery{Page: defaultPage, Size: defaultSize}

	if raw := values.Get("page"); raw != "" {
		page, err := strconv.Atoi(raw)
		if err != nil || page < 1 {
			return query, &fieldError{Field: "page", Message: "Debe ser un entero mayor o igual a 1."}
		}
		query.Page = page
	}
	if raw := values.Get("size"); raw != "" {
		size, err := strconv.Atoi(raw)
		if err != nil || size < 1 || size > application.MaxPageSize {
			return query, &fieldError{Field: "size", Message: "Debe estar entre 1 y 100."}
		}
		query.Size = size
	}
	if raw := values.Get("unread"); raw != "" {
		unread, err := strconv.ParseBool(raw)
		if err != nil {
			return query, &fieldError{Field: "unread", Message: "Debe ser true o false."}
		}
		query.UnreadOnly = unread
	}
	return query, nil
}

func toPageResponse(page application.NotificationPage) pageResponse {
	// make, no var: una lista vacía debe salir como [] y no como null.
	items := make([]notificationResponse, 0, len(page.Items))
	for _, view := range page.Items {
		items = append(items, notificationResponse{
			ID:         view.ID,
			Type:       view.Type,
			Message:    view.Message,
			PropertyID: optional(view.PropertyID),
			VisitID:    optional(view.VisitID),
			CreatedAt:  formatTime(view.CreatedAt),
			ReadAt:     optionalTime(view.ReadAt),
		})
	}
	return pageResponse{
		Data: items,
		Page: pageMeta{Number: page.Number, Size: page.Size, TotalElements: page.TotalElements, TotalPages: page.TotalPages},
	}
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func optionalTime(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := formatTime(*value)
	return &formatted
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339)
}

type markReadRequest struct {
	Read *bool `json:"read"`
}

func markNotificationRead(deps Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("notificationId")
		if err := uuid.Validate(id); err != nil {
			writeProblem(w, r, problemValidation, fieldError{Field: "notificationId", Message: "Debe ser un UUID."})
			return
		}
		if !readsTrue(w, r) {
			writeProblem(w, r, problemValidation, fieldError{Field: "read", Message: "Debe ser true: un aviso no se puede volver a marcar como no leído."})
			return
		}

		err := deps.MarkRead.Handle(r.Context(), application.MarkNotificationReadCommand{
			NotificationID: id,
			UserID:         userFrom(r.Context()),
		})
		switch {
		case err == nil:
			w.WriteHeader(http.StatusNoContent)
		case errors.Is(err, domain.ErrNotificationNotFound):
			writeProblem(w, r, problemNotificationNotFound)
		default:
			writeInternal(deps, w, r, err)
		}
	}
}

func readsTrue(w http.ResponseWriter, r *http.Request) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	decoder.DisallowUnknownFields()
	var request markReadRequest
	if err := decoder.Decode(&request); err != nil {
		return false
	}
	return request.Read != nil && *request.Read
}

// writeInternal deja el detalle solo en el log: puede tener SQL o direcciones internas.
func writeInternal(deps Dependencies, w http.ResponseWriter, r *http.Request, err error) {
	deps.Logger.Error("error atendiendo una request", "error", err, "correlationId", r.Header.Get(CorrelationHeader))
	writeProblem(w, r, problemInternal)
}
