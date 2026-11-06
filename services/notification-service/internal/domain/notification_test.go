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
	for _, notificationType := range []NotificationType{TypeWelcome, TypeVisitRequested, TypePropertyReserved} {
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

	notification.MarkRead(now.Add(time.Hour))

	if notification.ReadAt() == nil || !notification.ReadAt().Equal(now.Add(time.Hour)) {
		t.Errorf("ReadAt = %v", notification.ReadAt())
	}
}

func TestMarkReadTwiceKeepsTheFirstDate(t *testing.T) {
	notification := newValid(t)
	notification.MarkRead(now.Add(time.Hour))

	notification.MarkRead(now.Add(2 * time.Hour))

	if !notification.ReadAt().Equal(now.Add(time.Hour)) {
		t.Errorf("ReadAt = %v: debe conservar la primera fecha", notification.ReadAt())
	}
}

func TestReadAtCannotBeChangedFromOutside(t *testing.T) {
	notification := newValid(t)
	notification.MarkRead(now)

	*notification.ReadAt() = now.Add(time.Hour)

	if !notification.ReadAt().Equal(now) {
		t.Errorf("ReadAt = %v: se pudo cambiar desde afuera", notification.ReadAt())
	}
}

func TestBelongsTo(t *testing.T) {
	notification := newValid(t)

	if !notification.BelongsTo(recipient) {
		t.Error("no reconoce a su destinatario")
	}
	if notification.BelongsTo(property) {
		t.Error("reconoce a otro usuario")
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
