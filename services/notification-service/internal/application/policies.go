// Package application contiene los casos de uso: orquesta el dominio sin saber de HTTP, SQL ni Kafka.
package application

import (
	"context"
	"fmt"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/domain"
)

// ActorSystem es el actor de lo que hace una política, y no una persona (ADR 0005).
const ActorSystem = "SYSTEM"

// IdempotentNotificationStore guarda el aviso y el evento que lo originó en una sola transacción: si
// quedaran separados, un reinicio entre los dos pasos duplicaría el aviso o lo perdería.
type IdempotentNotificationStore interface {
	// SaveForEvent no hace nada si ese evento ya se procesó.
	SaveForEvent(ctx context.Context, eventID string, notification *domain.Notification) error
}

// NotifyOnEventCommand pide crear el aviso que origina un evento.
type NotifyOnEventCommand struct {
	EventID     string
	RecipientID string
	Type        domain.NotificationType
	PropertyID  string
	VisitID     string
}

// NotifyOnEvent crea el aviso de un evento.
type NotifyOnEvent struct {
	store IdempotentNotificationStore
	now   func() time.Time
}

// NewNotifyOnEvent recibe el reloj para que los tests no dependan de la hora real.
func NewNotifyOnEvent(store IdempotentNotificationStore, now func() time.Time) *NotifyOnEvent {
	return &NotifyOnEvent{store: store, now: now}
}

// Handle crea el aviso. Un error que envuelve domain.ErrInvalidNotification es permanente: reintentar
// no lo arregla. Cualquier otro es técnico y se puede reintentar.
func (h *NotifyOnEvent) Handle(ctx context.Context, command NotifyOnEventCommand) error {
	notification, err := domain.NewNotification(domain.NewNotificationParams{
		RecipientID: command.RecipientID,
		Type:        command.Type,
		PropertyID:  command.PropertyID,
		VisitID:     command.VisitID,
	}, h.now())
	if err != nil {
		return fmt.Errorf("crear el aviso: %w", err)
	}
	if err := h.store.SaveForEvent(ctx, command.EventID, notification); err != nil {
		return fmt.Errorf("guardar el aviso: %w", err)
	}
	return nil
}

// EventPolicies decide a quién avisar ante cada evento (ADR 0007). El consumidor de Kafka traduce el
// evento y la invoca: aquí no se conoce el formato del mensaje.
type EventPolicies struct {
	notify *NotifyOnEvent
}

// NewEventPolicies arma las políticas.
func NewEventPolicies(notify *NotifyOnEvent) *EventPolicies {
	return &EventPolicies{notify: notify}
}

// OnUserRegistered le da la bienvenida al usuario.
func (p *EventPolicies) OnUserRegistered(ctx context.Context, eventID, userID string) error {
	return p.notify.Handle(ctx, NotifyOnEventCommand{
		EventID: eventID, RecipientID: userID, Type: domain.TypeWelcome,
	})
}

// OnVisitRequested le avisa al agente de la propiedad.
func (p *EventPolicies) OnVisitRequested(ctx context.Context, eventID, agentID, propertyID, visitID string) error {
	return p.notify.Handle(ctx, NotifyOnEventCommand{
		EventID: eventID, RecipientID: agentID, Type: domain.TypeVisitRequested, PropertyID: propertyID, VisitID: visitID,
	})
}

// OnPropertyReserved le avisa al agente solo si la reservó una política: si la reservó él, ya lo sabe.
func (p *EventPolicies) OnPropertyReserved(ctx context.Context, eventID, agentID, propertyID, actor string) error {
	if actor != ActorSystem {
		return nil
	}
	return p.notify.Handle(ctx, NotifyOnEventCommand{
		EventID: eventID, RecipientID: agentID, Type: domain.TypePropertyReserved, PropertyID: propertyID,
	})
}
