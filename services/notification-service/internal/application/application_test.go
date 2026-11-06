package application

import (
	"context"
	"errors"
	"slices"
	"sort"
	"testing"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/domain"
)

const (
	userA     = "6f1c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01"
	userB     = "7a2d3b8f-2c3e-4d9f-8a21-6b7c8d9e0f12"
	property  = "3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01"
	visit     = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
	eventOne  = "1b2c3d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d"
	eventTwo  = "2c3d4e5f-6071-4b2c-8d3e-4f5a6b7c8d9e"
	unknownID = "00000000-0000-4000-8000-000000000000"
)

var testNow = time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC)

func fixedClock() time.Time { return testNow }

// inMemoryStore cumple los mismos contratos que el repositorio de PostgreSQL.
type inMemoryStore struct {
	items     map[string]*domain.Notification
	processed map[string]bool
	failWith  error
}

func newStore() *inMemoryStore {
	return &inMemoryStore{items: map[string]*domain.Notification{}, processed: map[string]bool{}}
}

func (s *inMemoryStore) SaveForEvent(_ context.Context, eventID string, notification *domain.Notification) error {
	if s.failWith != nil {
		return s.failWith
	}
	if s.processed[eventID] {
		return nil
	}
	s.processed[eventID] = true
	s.items[notification.ID()] = notification
	return nil
}

func (s *inMemoryStore) FindByID(_ context.Context, id string) (*domain.Notification, error) {
	notification, ok := s.items[id]
	if !ok {
		return nil, domain.ErrNotificationNotFound
	}
	return notification, nil
}

func (s *inMemoryStore) Save(_ context.Context, notification *domain.Notification) error {
	if s.failWith != nil {
		return s.failWith
	}
	s.items[notification.ID()] = notification
	return nil
}

func (s *inMemoryStore) ListByRecipient(_ context.Context, query ListNotificationsQuery) ([]NotificationView, int, error) {
	var views []NotificationView
	for _, notification := range s.items {
		if notification.RecipientID() != query.UserID || (query.UnreadOnly && notification.ReadAt() != nil) {
			continue
		}
		views = append(views, NotificationView{ID: notification.ID(), Type: string(notification.Type()), CreatedAt: notification.CreatedAt()})
	}
	// Desempata por ID, como el repositorio real: con la misma fecha, sin esto el orden depende del mapa.
	sort.Slice(views, func(i, j int) bool {
		if !views[i].CreatedAt.Equal(views[j].CreatedAt) {
			return views[i].CreatedAt.After(views[j].CreatedAt)
		}
		return views[i].ID > views[j].ID
	})
	total := len(views)
	start := min((query.Page-1)*query.Size, total)
	end := min(start+query.Size, total)
	return views[start:end], total, nil
}

func (s *inMemoryStore) only(t *testing.T) *domain.Notification {
	t.Helper()
	if len(s.items) != 1 {
		t.Fatalf("avisos = %d, want 1", len(s.items))
	}
	for _, notification := range s.items {
		return notification
	}
	return nil
}

func newPolicies(store *inMemoryStore) *EventPolicies {
	return NewEventPolicies(NewNotifyOnEvent(store, fixedClock))
}

func TestUserRegisteredWelcomesTheUser(t *testing.T) {
	store := newStore()

	err := newPolicies(store).OnUserRegistered(context.Background(), eventOne, userA)
	if err != nil {
		t.Fatal(err)
	}

	notification := store.only(t)
	if notification.RecipientID() != userA || notification.Type() != domain.TypeWelcome {
		t.Errorf("aviso = %s para %s", notification.Type(), notification.RecipientID())
	}
}

func TestVisitRequestedNotifiesTheAgent(t *testing.T) {
	store := newStore()

	err := newPolicies(store).OnVisitRequested(context.Background(), eventOne, userA, property, visit)
	if err != nil {
		t.Fatal(err)
	}

	notification := store.only(t)
	if notification.RecipientID() != userA || notification.Type() != domain.TypeVisitRequested {
		t.Errorf("aviso = %s para %s", notification.Type(), notification.RecipientID())
	}
	if notification.PropertyID() != property || notification.VisitID() != visit {
		t.Errorf("referencias = %s, %s", notification.PropertyID(), notification.VisitID())
	}
}

func TestPropertyReservedOnlyNotifiesWhenTheSystemReservedIt(t *testing.T) {
	tests := []struct {
		name, actor string
		notifies    bool
	}{
		{"la reservó la política", ActorSystem, true},
		{"la reservó el propio agente: ya lo sabe", "AGENT", false},
		{"actor desconocido", "OTRO", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newStore()

			err := newPolicies(store).OnPropertyReserved(context.Background(), eventOne, userA, property, tt.actor)
			if err != nil {
				t.Fatal(err)
			}

			if got := len(store.items) == 1; got != tt.notifies {
				t.Errorf("avisó = %v, want %v", got, tt.notifies)
			}
		})
	}
}

// Kafka entrega al menos una vez: el mismo evento no debe duplicar el aviso.
func TestSameEventTwiceCreatesOneNotification(t *testing.T) {
	store := newStore()
	policies := newPolicies(store)

	for range 2 {
		if err := policies.OnUserRegistered(context.Background(), eventOne, userA); err != nil {
			t.Fatal(err)
		}
	}

	if len(store.items) != 1 {
		t.Errorf("avisos = %d, want 1", len(store.items))
	}
}

func TestDifferentEventsCreateDifferentNotifications(t *testing.T) {
	store := newStore()
	policies := newPolicies(store)

	_ = policies.OnUserRegistered(context.Background(), eventOne, userA)
	_ = policies.OnUserRegistered(context.Background(), eventTwo, userA)

	if len(store.items) != 2 {
		t.Errorf("avisos = %d, want 2", len(store.items))
	}
}

func TestInvalidEventDataIsPermanent(t *testing.T) {
	err := newPolicies(newStore()).OnUserRegistered(context.Background(), eventOne, "no-es-uuid")

	if !IsPermanent(err) {
		t.Errorf("error = %v: reintentarlo no lo arregla", err)
	}
}

func TestStoreFailureIsReturnedForRetry(t *testing.T) {
	store := newStore()
	store.failWith = errors.New("base caída")

	err := newPolicies(store).OnUserRegistered(context.Background(), eventOne, userA)

	if err == nil || IsPermanent(err) {
		t.Errorf("error = %v: debe poder reintentarse", err)
	}
}

func seeded(t *testing.T, store *inMemoryStore, recipient string) string {
	t.Helper()
	notification, err := domain.NewNotification(domain.NewNotificationParams{RecipientID: recipient, Type: domain.TypeWelcome}, testNow)
	if err != nil {
		t.Fatal(err)
	}
	store.items[notification.ID()] = notification
	return notification.ID()
}

func TestMarkReadByTheRecipient(t *testing.T) {
	store := newStore()
	id := seeded(t, store, userA)

	err := NewMarkNotificationRead(store, fixedClock).Handle(context.Background(), MarkNotificationReadCommand{NotificationID: id, UserID: userA})
	if err != nil {
		t.Fatal(err)
	}

	if store.items[id].ReadAt() == nil {
		t.Error("no quedó leído")
	}
}

// Es 404 y no 403: no se revela que el aviso de otro usuario existe.
func TestMarkReadOfAnotherUserLooksLikeNotFound(t *testing.T) {
	store := newStore()
	id := seeded(t, store, userA)

	err := NewMarkNotificationRead(store, fixedClock).Handle(context.Background(), MarkNotificationReadCommand{NotificationID: id, UserID: userB})

	if !errors.Is(err, domain.ErrNotificationNotFound) {
		t.Errorf("error = %v", err)
	}
	if store.items[id].ReadAt() != nil {
		t.Error("otro usuario marcó el aviso")
	}
}

func TestMarkReadOfUnknownNotification(t *testing.T) {
	err := NewMarkNotificationRead(newStore(), fixedClock).Handle(context.Background(), MarkNotificationReadCommand{NotificationID: unknownID, UserID: userA})

	if !errors.Is(err, domain.ErrNotificationNotFound) {
		t.Errorf("error = %v", err)
	}
}

func TestListReturnsOnlyTheUsersNotifications(t *testing.T) {
	store := newStore()
	mine := seeded(t, store, userA)
	seeded(t, store, userB)

	page, err := NewListNotifications(store).Handle(context.Background(), ListNotificationsQuery{UserID: userA, Page: 1, Size: 20})
	if err != nil {
		t.Fatal(err)
	}

	if len(page.Items) != 1 || page.Items[0].ID != mine {
		t.Errorf("items = %+v", page.Items)
	}
	if page.TotalElements != 1 || page.TotalPages != 1 || page.Number != 1 || page.Size != 20 {
		t.Errorf("page = %+v", page)
	}
}

func TestListUnreadOnly(t *testing.T) {
	store := newStore()
	read := seeded(t, store, userA)
	unread := seeded(t, store, userA)
	_ = store.items[read].MarkReadBy(userA, testNow)

	page, err := NewListNotifications(store).Handle(context.Background(), ListNotificationsQuery{UserID: userA, Page: 1, Size: 20, UnreadOnly: true})
	if err != nil {
		t.Fatal(err)
	}

	if len(page.Items) != 1 || page.Items[0].ID != unread {
		t.Errorf("items = %+v", page.Items)
	}
}

func TestListComputesTotalPages(t *testing.T) {
	tests := []struct {
		total, size, wantPages int
	}{
		{0, 20, 0},
		{1, 20, 1},
		{20, 20, 1},
		{21, 20, 2},
		{5, 2, 3},
	}

	for _, tt := range tests {
		store := newStore()
		for range tt.total {
			seeded(t, store, userA)
		}

		page, err := NewListNotifications(store).Handle(context.Background(), ListNotificationsQuery{UserID: userA, Page: 1, Size: tt.size})
		if err != nil {
			t.Fatal(err)
		}

		if page.TotalPages != tt.wantPages || page.TotalElements != tt.total {
			t.Errorf("total %d, size %d: page = %+v", tt.total, tt.size, page)
		}
	}
}

func TestListDoesNotReturnAnotherPagesItems(t *testing.T) {
	store := newStore()
	for range 3 {
		seeded(t, store, userA)
	}

	first, _ := NewListNotifications(store).Handle(context.Background(), ListNotificationsQuery{UserID: userA, Page: 1, Size: 2})
	second, _ := NewListNotifications(store).Handle(context.Background(), ListNotificationsQuery{UserID: userA, Page: 2, Size: 2})

	if len(first.Items) != 2 || len(second.Items) != 1 {
		t.Fatalf("páginas = %d, %d", len(first.Items), len(second.Items))
	}
	if slices.ContainsFunc(first.Items, func(view NotificationView) bool { return view.ID == second.Items[0].ID }) {
		t.Error("un aviso aparece en dos páginas")
	}
}

// Sin validar, size=0 dividiría por cero al calcular las páginas.
func TestListRejectsInvalidPagination(t *testing.T) {
	tests := []struct {
		name       string
		page, size int
	}{
		{"página cero", 0, 20},
		{"página negativa", -1, 20},
		{"tamaño cero", 1, 0},
		{"tamaño negativo", 1, -1},
		{"tamaño sobre el máximo", 1, MaxPageSize + 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewListNotifications(newStore()).Handle(context.Background(), ListNotificationsQuery{UserID: userA, Page: tt.page, Size: tt.size})

			if !errors.Is(err, ErrInvalidPagination) {
				t.Errorf("error = %v, want ErrInvalidPagination", err)
			}
		})
	}
}

func TestListAcceptsTheMaximumSize(t *testing.T) {
	_, err := NewListNotifications(newStore()).Handle(context.Background(), ListNotificationsQuery{UserID: userA, Page: 1, Size: MaxPageSize})
	if err != nil {
		t.Errorf("error = %v", err)
	}
}
