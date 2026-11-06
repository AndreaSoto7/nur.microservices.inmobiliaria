package postgres

import (
	"context"
	"errors"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/application"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/domain"
)

const (
	userA    = "6f1c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01"
	userB    = "7a2d3b8f-2c3e-4d9f-8a21-6b7c8d9e0f12"
	property = "3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01"
	visit    = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
	eventOne = "1b2c3d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d"
	eventTwo = "2c3d4e5f-6071-4b2c-8d3e-4f5a6b7c8d9e"
)

var testNow = time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC)

// newRepository usa una base real: el SQL y las transacciones solo se prueban de verdad contra PostgreSQL.
func newRepository(t *testing.T) (*Repository, *pgxpool.Pool) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL no está definida")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := Migrate(context.Background(), pool); err != nil {
		t.Fatalf("Migrate() error = %v", err)
	}
	if _, err := pool.Exec(context.Background(), "TRUNCATE notifications, processed_events"); err != nil {
		t.Fatal(err)
	}
	return NewRepository(pool), pool
}

func newNotification(t *testing.T, recipient string, createdAt time.Time) *domain.Notification {
	t.Helper()
	notification, err := domain.NewNotification(domain.NewNotificationParams{
		RecipientID: recipient, Type: domain.TypeVisitRequested, PropertyID: property, VisitID: visit,
	}, createdAt)
	if err != nil {
		t.Fatal(err)
	}
	return notification
}

func TestMigrateTwiceIsHarmless(t *testing.T) {
	_, pool := newRepository(t)

	if err := Migrate(context.Background(), pool); err != nil {
		t.Errorf("Migrate() error = %v", err)
	}
}

// Con --scale, varias réplicas arrancan a la vez: el advisory lock evita que choquen.
func TestConcurrentMigrationsDoNotCollide(t *testing.T) {
	_, pool := newRepository(t)
	var wg sync.WaitGroup
	var failures atomic.Int64

	for range 5 {
		wg.Go(func() {
			if err := Migrate(context.Background(), pool); err != nil {
				failures.Add(1)
			}
		})
	}
	wg.Wait()

	if got := failures.Load(); got != 0 {
		t.Errorf("fallaron %d migraciones", got)
	}
}

func TestSaveForEventAndFindRoundTrip(t *testing.T) {
	repository, _ := newRepository(t)
	notification := newNotification(t, userA, testNow)

	if err := repository.SaveForEvent(context.Background(), eventOne, notification); err != nil {
		t.Fatal(err)
	}
	found, err := repository.FindByID(context.Background(), notification.ID())
	if err != nil {
		t.Fatal(err)
	}

	if found.ID() != notification.ID() || found.RecipientID() != userA || found.Type() != domain.TypeVisitRequested {
		t.Errorf("found = %+v", found)
	}
	if found.Message() != notification.Message() || found.PropertyID() != property || found.VisitID() != visit {
		t.Errorf("found = %+v", found)
	}
	if !found.CreatedAt().Equal(testNow) || found.ReadAt() != nil {
		t.Errorf("fechas = %v, %v", found.CreatedAt(), found.ReadAt())
	}
}

func TestOptionalReferencesRoundTripAsEmpty(t *testing.T) {
	repository, _ := newRepository(t)
	notification, err := domain.NewNotification(domain.NewNotificationParams{RecipientID: userA, Type: domain.TypeWelcome}, testNow)
	if err != nil {
		t.Fatal(err)
	}
	if err := repository.SaveForEvent(context.Background(), eventOne, notification); err != nil {
		t.Fatal(err)
	}

	found, err := repository.FindByID(context.Background(), notification.ID())
	if err != nil {
		t.Fatal(err)
	}

	if found.PropertyID() != "" || found.VisitID() != "" {
		t.Errorf("referencias = %q, %q", found.PropertyID(), found.VisitID())
	}
}

func TestSameEventTwiceSavesOneNotification(t *testing.T) {
	repository, _ := newRepository(t)

	for range 2 {
		if err := repository.SaveForEvent(context.Background(), eventOne, newNotification(t, userA, testNow)); err != nil {
			t.Fatal(err)
		}
	}

	_, total, err := repository.ListByRecipient(context.Background(), application.ListNotificationsQuery{UserID: userA, Page: 1, Size: 20})
	if err != nil {
		t.Fatal(err)
	}
	if total != 1 {
		t.Errorf("avisos = %d, want 1", total)
	}
}

func TestSameEventConcurrentlySavesOneNotification(t *testing.T) {
	repository, _ := newRepository(t)
	var wg sync.WaitGroup

	for range 10 {
		notification := newNotification(t, userA, testNow)
		wg.Go(func() {
			if err := repository.SaveForEvent(context.Background(), eventOne, notification); err != nil {
				t.Errorf("SaveForEvent() error = %v", err)
			}
		})
	}
	wg.Wait()

	_, total, _ := repository.ListByRecipient(context.Background(), application.ListNotificationsQuery{UserID: userA, Page: 1, Size: 20})
	if total != 1 {
		t.Errorf("avisos = %d, want 1", total)
	}
}

// El aviso y el evento van juntos: si el aviso falla, el evento no queda procesado y se puede reintentar.
func TestFailedNotificationDoesNotMarkTheEventAsProcessed(t *testing.T) {
	repository, pool := newRepository(t)
	// Reconstitute no valida, así que deja pasar un tipo que la base rechaza.
	invalid := domain.Reconstitute(domain.ReconstituteParams{
		ID: visit, RecipientID: userA, Type: "OTRO", Message: "x", CreatedAt: testNow,
	})

	if err := repository.SaveForEvent(context.Background(), eventOne, invalid); err == nil {
		t.Fatal("SaveForEvent() no falló")
	}

	var processed int
	if err := pool.QueryRow(context.Background(), "SELECT count(*) FROM processed_events").Scan(&processed); err != nil {
		t.Fatal(err)
	}
	if processed != 0 {
		t.Error("el evento quedó procesado sin su aviso: se perdería")
	}
}

func TestFindUnknownReturnsNotFound(t *testing.T) {
	repository, _ := newRepository(t)

	_, err := repository.FindByID(context.Background(), userA)

	if !errors.Is(err, domain.ErrNotificationNotFound) {
		t.Errorf("error = %v", err)
	}
}

func TestSavePersistsReadAt(t *testing.T) {
	repository, _ := newRepository(t)
	notification := newNotification(t, userA, testNow)
	if err := repository.SaveForEvent(context.Background(), eventOne, notification); err != nil {
		t.Fatal(err)
	}
	if err := notification.MarkReadBy(userA, testNow.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}

	if err := repository.Save(context.Background(), notification); err != nil {
		t.Fatal(err)
	}

	found, err := repository.FindByID(context.Background(), notification.ID())
	if err != nil {
		t.Fatal(err)
	}
	if found.ReadAt() == nil || !found.ReadAt().Equal(testNow.Add(time.Hour)) {
		t.Errorf("ReadAt = %v", found.ReadAt())
	}
}

func TestListFiltersOrdersAndPaginates(t *testing.T) {
	repository, _ := newRepository(t)
	ctx := context.Background()
	older := newNotification(t, userA, testNow)
	newer := newNotification(t, userA, testNow.Add(time.Hour))
	other := newNotification(t, userB, testNow)
	for event, notification := range map[string]*domain.Notification{eventOne: older, eventTwo: newer, visit: other} {
		if err := repository.SaveForEvent(ctx, event, notification); err != nil {
			t.Fatal(err)
		}
	}

	items, total, err := repository.ListByRecipient(ctx, application.ListNotificationsQuery{UserID: userA, Page: 1, Size: 1})
	if err != nil {
		t.Fatal(err)
	}
	if total != 2 || len(items) != 1 || items[0].ID != newer.ID() {
		t.Fatalf("primera página: total = %d, items = %+v", total, items)
	}
	if items[0].Type != "VISIT_REQUESTED" || items[0].PropertyID != property || items[0].VisitID != visit || items[0].Message == "" {
		t.Errorf("view = %+v", items[0])
	}

	items, _, err = repository.ListByRecipient(ctx, application.ListNotificationsQuery{UserID: userA, Page: 2, Size: 1})
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != older.ID() {
		t.Errorf("segunda página: items = %+v", items)
	}

	if err := newer.MarkReadBy(userA, testNow); err != nil {
		t.Fatal(err)
	}
	if err := repository.Save(ctx, newer); err != nil {
		t.Fatal(err)
	}
	items, total, err = repository.ListByRecipient(ctx, application.ListNotificationsQuery{UserID: userA, Page: 1, Size: 20, UnreadOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	if total != 1 || len(items) != 1 || items[0].ID != older.ID() {
		t.Errorf("sin leer: total = %d, items = %+v", total, items)
	}
}

func TestPing(t *testing.T) {
	repository, _ := newRepository(t)

	if err := repository.Ping(context.Background()); err != nil {
		t.Errorf("Ping() error = %v", err)
	}
}
