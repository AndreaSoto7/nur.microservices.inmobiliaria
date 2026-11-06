package application

import (
	"context"
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

// Handle responde domain.ErrNotificationNotFound si el aviso no existe o es de otro usuario.
func (h *MarkNotificationRead) Handle(ctx context.Context, command MarkNotificationReadCommand) error {
	notification, err := h.repository.FindByID(ctx, command.NotificationID)
	if err != nil {
		return fmt.Errorf("cargar el aviso: %w", err)
	}
	if err := notification.MarkReadBy(command.UserID, h.now()); err != nil {
		return fmt.Errorf("marcar el aviso: %w", err)
	}
	if err := h.repository.Save(ctx, notification); err != nil {
		return fmt.Errorf("guardar el aviso: %w", err)
	}
	return nil
}
