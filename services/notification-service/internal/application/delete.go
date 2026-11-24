package application

import (
	"context"
	"fmt"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/domain"
)

// DeleteNotificationCommand pide borrar un aviso que ya no le interesa al usuario.
type DeleteNotificationCommand struct {
	NotificationID string
	UserID         string
}

// DeleteNotification borra un aviso de su destinatario.
type DeleteNotification struct {
	repository domain.NotificationRepository
}

// NewDeleteNotification arma el caso de uso.
func NewDeleteNotification(repository domain.NotificationRepository) *DeleteNotification {
	return &DeleteNotification{repository: repository}
}

// Handle responde domain.ErrNotificationNotFound si el aviso no existe o es de otro usuario.
func (h *DeleteNotification) Handle(ctx context.Context, command DeleteNotificationCommand) error {
	notification, err := h.repository.FindByID(ctx, command.NotificationID)
	if err != nil {
		return fmt.Errorf("cargar el aviso: %w", err)
	}
	if err := notification.CanBeDeletedBy(command.UserID); err != nil {
		return fmt.Errorf("borrar el aviso: %w", err)
	}
	if err := h.repository.Delete(ctx, notification.ID(), notification.RecipientID()); err != nil {
		return fmt.Errorf("borrar el aviso: %w", err)
	}
	return nil
}
