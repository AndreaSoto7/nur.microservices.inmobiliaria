package application

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// MaxPageSize es el tamaño máximo de página (rule api-rest).
const MaxPageSize = 100

// MaxPage acota el OFFSET: sin tope, una página enorme lo desbordaría.
const MaxPage = 1_000_000

// ErrInvalidPagination indica una página o un tamaño fuera de rango.
var ErrInvalidPagination = errors.New("paginación inválida")

// ListNotificationsQuery pide una página de avisos del usuario.
type ListNotificationsQuery struct {
	UserID     string
	Page       int
	Size       int
	UnreadOnly bool
}

// NotificationView es un aviso para leer. Es del lado consulta: no pasa por el aggregate.
type NotificationView struct {
	ID         string
	Type       string
	Message    string
	PropertyID string
	VisitID    string
	CreatedAt  time.Time
	ReadAt     *time.Time
}

// NotificationPage es una página de avisos.
type NotificationPage struct {
	Items         []NotificationView
	Number        int
	Size          int
	TotalElements int
	TotalPages    int
}

// NotificationReader lee avisos. Lo implementa la infraestructura.
type NotificationReader interface {
	// ListByRecipient devuelve la página pedida, los más nuevos primero, y el total de elementos.
	ListByRecipient(ctx context.Context, query ListNotificationsQuery) ([]NotificationView, int, error)
}

// ListNotifications lista los avisos del usuario.
type ListNotifications struct {
	reader NotificationReader
}

// NewListNotifications arma la consulta.
func NewListNotifications(reader NotificationReader) *ListNotifications {
	return &ListNotifications{reader: reader}
}

// Handle devuelve la página pedida.
func (h *ListNotifications) Handle(ctx context.Context, query ListNotificationsQuery) (NotificationPage, error) {
	if query.Page < 1 || query.Page > MaxPage || query.Size < 1 || query.Size > MaxPageSize {
		return NotificationPage{}, ErrInvalidPagination
	}
	items, total, err := h.reader.ListByRecipient(ctx, query)
	if err != nil {
		return NotificationPage{}, fmt.Errorf("listar los avisos: %w", err)
	}
	return NotificationPage{
		Items:         items,
		Number:        query.Page,
		Size:          query.Size,
		TotalElements: total,
		TotalPages:    (total + query.Size - 1) / query.Size,
	}, nil
}
