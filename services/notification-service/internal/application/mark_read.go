package application

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/domain"
)

// MarkNotificationReadCommand pide marcar un aviso como leído.
type MarkNotificationReadCommand struct {
	NotificationID string
	UserID         string
}

// MarkNotificationRead marca un aviso como leído.
type MarkNotificationRead struct {
	repository domain.NotificationRepository
	now        func() time.Time
}

// NewMarkNotificationRead recibe el reloj para que los tests no dependan de la hora real.
func NewMarkNotificationRead(repository domain.NotificationRepository, now func() time.Time) *MarkNotificationRead {
	return &MarkNotificationRead{repository: repository, now: now}
}

// Handle responde domain.ErrNotificationNotFound también si el aviso es de otro usuario: no se revela
// que existe.
func (h *MarkNotificationRead) Handle(ctx context.Context, command MarkNotificationReadCommand) error {
	notification, err := h.repository.FindByID(ctx, command.NotificationID)
	if errors.Is(err, domain.ErrNotificationNotFound) {
		return domain.ErrNotificationNotFound
	}
	if err != nil {
		return fmt.Errorf("cargar el aviso: %w", err)
	}
	if !notification.BelongsTo(command.UserID) {
		return domain.ErrNotificationNotFound
	}
	notification.MarkRead(h.now())
	if err := h.repository.Save(ctx, notification); err != nil {
		return fmt.Errorf("guardar el aviso: %w", err)
	}
	return nil
}
