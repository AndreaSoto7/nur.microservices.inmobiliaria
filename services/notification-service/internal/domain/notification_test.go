package domain

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

var now = time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC)

const (
	recipient = "6f1c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01"
	property  = "3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01"
	visit     = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
)

func newValid(t *testing.T) *Notification {
	t.Helper()
	notification, err := NewNotification(NewNotificationParams{RecipientID: recipient, Type: TypeWelcome}, now)
	if err != nil {
		t.Fatal(err)
	}
	return notification
}

func TestNewNotificationGeneratesIdentityAndStartsUnread(t *testing.T) {
	notification, err := NewNotification(NewNotificationParams{
		RecipientID: recipient, Type: TypeVisitRequested, PropertyID: property, VisitID: visit,
	}, now)
	if err != nil {
		t.Fatalf("NewNotification() error = %v", err)
	}

	if _, err := uuid.Parse(notification.ID()); err != nil {
		t.Errorf("ID = %q: %v", notification.ID(), err)
	}
	if notification.RecipientID() != recipient || notification.Type() != TypeVisitRequested {
		t.Errorf("notification = %+v", notification)
	}
	if notification.PropertyID() != property || notification.VisitID() != visit {
		t.Errorf("referencias = %q, %q", notification.PropertyID(), notification.VisitID())
	}
	if !notification.CreatedAt().Equal(now) {
		t.Errorf("CreatedAt = %v", notification.CreatedAt())
	}
	if notification.ReadAt() != nil {
		t.Errorf("ReadAt = %v: debe nacer sin leer", notification.ReadAt())
	}
}

func TestEachTypeHasItsOwnMessage(t *testing.T) {
	seen := map[string]NotificationType{}
	for _, notificationType := range []NotificationType{
		TypeWelcome, TypeVisitRequested, TypePropertyReserved, TypeInquiryReceived,
		TypeVisitScheduled, TypeVisitRejected, TypeVisitCancelled, TypeVisitCancelledByClient, TypeVisitCompleted,
	} {
		notification, err := NewNotification(NewNotificationParams{RecipientID: recipient, Type: notificationType}, now)
		if err != nil {
			t.Fatalf("%s: %v", notificationType, err)
		}
		if notification.Message() == "" {
			t.Errorf("%s no tiene mensaje", notificationType)
		}
		if other, repeated := seen[notification.Message()]; repeated {
			t.Errorf("%s y %s comparten mensaje", notificationType, other)
		}
		seen[notification.Message()] = notificationType
	}
}

func TestNewNotificationRejectsInvalidData(t *testing.T) {
	tests := []struct {
		name   string
		params NewNotificationParams
	}{
		{"sin destinatario", NewNotificationParams{Type: TypeWelcome}},
		{"destinatario que no es UUID", NewNotificationParams{RecipientID: "abc", Type: TypeWelcome}},
		{"sin tipo", NewNotificationParams{RecipientID: recipient}},
		{"tipo desconocido", NewNotificationParams{RecipientID: recipient, Type: "OTRO"}},
		{"propiedad que no es UUID", NewNotificationParams{RecipientID: recipient, Type: TypeWelcome, PropertyID: "abc"}},
		{"visita que no es UUID", NewNotificationParams{RecipientID: recipient, Type: TypeWelcome, VisitID: "abc"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewNotification(tt.params, now)

			if !errors.Is(err, ErrInvalidNotification) {
				t.Errorf("error = %v, want ErrInvalidNotification", err)
			}
		})
	}
}

func TestMarkReadSetsTheDate(t *testing.T) {
	notification := newValid(t)

	if err := notification.MarkReadBy(recipient, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}

	if notification.ReadAt() == nil || !notification.ReadAt().Equal(now.Add(time.Hour)) {
		t.Errorf("ReadAt = %v", notification.ReadAt())
	}
}

func TestMarkReadTwiceKeepsTheFirstDate(t *testing.T) {
	notification := newValid(t)
	_ = notification.MarkReadBy(recipient, now.Add(time.Hour))

	_ = notification.MarkReadBy(recipient, now.Add(2*time.Hour))

	if !notification.ReadAt().Equal(now.Add(time.Hour)) {
		t.Errorf("ReadAt = %v: debe conservar la primera fecha", notification.ReadAt())
	}
}

func TestReadAtCannotBeChangedFromOutside(t *testing.T) {
	notification := newValid(t)
	_ = notification.MarkReadBy(recipient, now)

	*notification.ReadAt() = now.Add(time.Hour)

	if !notification.ReadAt().Equal(now) {
		t.Errorf("ReadAt = %v: se pudo cambiar desde afuera", notification.ReadAt())
	}
}

// Es "no encontrado" y no "prohibido": no se revela que el aviso de otro usuario existe.
func TestOnlyTheRecipientCanMarkRead(t *testing.T) {
	notification := newValid(t)

	err := notification.MarkReadBy(property, now)

	if !errors.Is(err, ErrNotificationNotFound) {
		t.Errorf("error = %v, want ErrNotificationNotFound", err)
	}
	if notification.ReadAt() != nil {
		t.Error("otro usuario marcó el aviso")
	}
}

// BelongsTo compara contra el sub del JWT: el mismo UUID en otro formato no debe dejar el aviso sin dueño.
func TestUUIDsAreNormalized(t *testing.T) {
	notification, err := NewNotification(NewNotificationParams{
		RecipientID: "6F1C2A7E-1B2D-4C8E-9F10-5A6B7C8D9E01",
		Type:        TypeVisitRequested,
		PropertyID:  "urn:uuid:3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01",
		VisitID:     "9a8b7c6d5e4f4a3b8c2d1e0f9a8b7c6d",
	}, now)
	if err != nil {
		t.Fatal(err)
	}

	if notification.RecipientID() != recipient || notification.PropertyID() != property || notification.VisitID() != visit {
		t.Errorf("IDs = %s, %s, %s", notification.RecipientID(), notification.PropertyID(), notification.VisitID())
	}
	if err := notification.MarkReadBy(recipient, now); err != nil {
		t.Errorf("MarkReadBy() error = %v", err)
	}
}

func TestReconstituteRestoresStateWithoutValidatingOrChangingIt(t *testing.T) {
	readAt := now.Add(time.Hour)

	notification := Reconstitute(ReconstituteParams{
		ID: visit, RecipientID: recipient, Type: TypeWelcome, Message: "texto guardado", PropertyID: property,
		CreatedAt: now, ReadAt: &readAt,
	})

	if notification.ID() != visit || notification.Message() != "texto guardado" {
		t.Errorf("notification = %+v", notification)
	}
	if notification.ReadAt() == nil || !notification.ReadAt().Equal(readAt) {
		t.Errorf("ReadAt = %v", notification.ReadAt())
	}
}
