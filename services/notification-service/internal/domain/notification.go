// Package domain contiene el modelo de avisos. No conoce ni la base, ni HTTP, ni Kafka.
package domain

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// NotificationType es el motivo de un aviso.
type NotificationType string

// Tipos de aviso (ADR 0007).
const (
	TypeWelcome          NotificationType = "WELCOME"
	TypeVisitRequested   NotificationType = "VISIT_REQUESTED"
	TypePropertyReserved NotificationType = "PROPERTY_RESERVED"
)

// El texto es fijo por tipo: así un aviso nunca lleva datos personales.
var messages = map[NotificationType]string{
	TypeWelcome:          "Te damos la bienvenida a la plataforma.",
	TypeVisitRequested:   "Recibiste una nueva solicitud de visita.",
	TypePropertyReserved: "Tu propiedad quedó reservada porque ganaste una oportunidad.",
}

var (
	// ErrInvalidNotification indica datos con los que no se puede crear un aviso.
	ErrInvalidNotification = errors.New("aviso inválido")
	// ErrNotificationNotFound indica que el aviso no existe, o que es de otro usuario.
	ErrNotificationNotFound = errors.New("aviso no encontrado")
)

// Notification es el aggregate: un aviso para un usuario.
type Notification struct {
	id          string
	recipientID string
	kind        NotificationType
	message     string
	propertyID  string
	visitID     string
	createdAt   time.Time
	readAt      *time.Time
}

// NewNotificationParams son los datos para crear un aviso. PropertyID y VisitID son opcionales.
type NewNotificationParams struct {
	RecipientID string
	Type        NotificationType
	PropertyID  string
	VisitID     string
}

// NewNotification crea un aviso válido, sin leer. El dominio genera su identidad.
func NewNotification(params NewNotificationParams, now time.Time) (*Notification, error) {
	message, known := messages[params.Type]
	if !known {
		return nil, fmt.Errorf("%w: tipo %q", ErrInvalidNotification, params.Type)
	}
	if err := uuid.Validate(params.RecipientID); err != nil {
		return nil, fmt.Errorf("%w: destinatario", ErrInvalidNotification)
	}
	for name, reference := range map[string]string{"propiedad": params.PropertyID, "visita": params.VisitID} {
		if reference == "" {
			continue
		}
		if err := uuid.Validate(reference); err != nil {
			return nil, fmt.Errorf("%w: %s", ErrInvalidNotification, name)
		}
	}
	return &Notification{
		id:          uuid.NewString(),
		recipientID: params.RecipientID,
		kind:        params.Type,
		message:     message,
		propertyID:  params.PropertyID,
		visitID:     params.VisitID,
		createdAt:   now,
	}, nil
}

// ReconstituteParams es el estado guardado de un aviso.
type ReconstituteParams struct {
	ID          string
	RecipientID string
	Type        NotificationType
	Message     string
	PropertyID  string
	VisitID     string
	CreatedAt   time.Time
	ReadAt      *time.Time
}

// Reconstitute carga un aviso guardado. No valida: lo guardado ya pasó por NewNotification, y un texto
// viejo debe seguir leyéndose aunque el mensaje del tipo haya cambiado.
func Reconstitute(params ReconstituteParams) *Notification {
	return &Notification{
		id:          params.ID,
		recipientID: params.RecipientID,
		kind:        params.Type,
		message:     params.Message,
		propertyID:  params.PropertyID,
		visitID:     params.VisitID,
		createdAt:   params.CreatedAt,
		readAt:      copyTime(params.ReadAt),
	}
}

// MarkRead marca el aviso como leído. Es idempotente: conserva la primera fecha.
func (n *Notification) MarkRead(now time.Time) {
	if n.readAt == nil {
		n.readAt = &now
	}
}

// BelongsTo indica si el aviso es de ese usuario.
func (n *Notification) BelongsTo(userID string) bool { return n.recipientID == userID }

// ID devuelve el identificador del aviso.
func (n *Notification) ID() string { return n.id }

// RecipientID devuelve el usuario que recibe el aviso.
func (n *Notification) RecipientID() string { return n.recipientID }

// Type devuelve el motivo del aviso.
func (n *Notification) Type() NotificationType { return n.kind }

// Message devuelve el texto del aviso.
func (n *Notification) Message() string { return n.message }

// PropertyID devuelve la propiedad relacionada, o vacío.
func (n *Notification) PropertyID() string { return n.propertyID }

// VisitID devuelve la visita relacionada, o vacío.
func (n *Notification) VisitID() string { return n.visitID }

// CreatedAt devuelve cuándo se creó el aviso.
func (n *Notification) CreatedAt() time.Time { return n.createdAt }

// ReadAt devuelve una copia de la fecha de lectura, o nil si no se leyó: el aggregate no expone su estado
// para que se cambie desde afuera.
func (n *Notification) ReadAt() *time.Time { return copyTime(n.readAt) }

func copyTime(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	copied := *value
	return &copied
}

// NotificationRepository guarda y carga el aggregate. Lo implementa la infraestructura.
type NotificationRepository interface {
	// FindByID devuelve ErrNotificationNotFound si no existe.
	FindByID(ctx context.Context, id string) (*Notification, error)
	Save(ctx context.Context, notification *Notification) error
}
