package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/application"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/domain"
)

const notificationColumns = `id::text, recipient_id::text, type, message,
	coalesce(property_id::text, ''), coalesce(visit_id::text, ''), created_at, read_at`

// Repository implementa los puertos de persistencia. Las columnas uuid viajan como texto: el dominio
// maneja los IDs como strings, y NULLIF convierte a NULL las referencias vacías.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository arma el repositorio.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// Ping revisa la conexión, para el readiness.
func (r *Repository) Ping(ctx context.Context) error {
	if err := r.pool.Ping(ctx); err != nil {
		return fmt.Errorf("hablar con la base: %w", err)
	}
	return nil
}

// SaveForEvent guarda el aviso y el evento en una transacción. Si otra réplica ya procesó el evento, la
// clave primaria lo detecta y no guarda nada.
func (r *Repository) SaveForEvent(ctx context.Context, eventID string, notification *domain.Notification) error {
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `INSERT INTO processed_events (event_id, processed_at) VALUES ($1, $2)
			ON CONFLICT (event_id) DO NOTHING`, eventID, notification.CreatedAt())
		if err != nil {
			return fmt.Errorf("registrar el evento: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return nil
		}
		return upsert(ctx, tx, notification)
	})
	if err != nil {
		return fmt.Errorf("guardar el aviso del evento: %w", err)
	}
	return nil
}

// Save guarda el aggregate.
func (r *Repository) Save(ctx context.Context, notification *domain.Notification) error {
	return upsert(ctx, r.pool, notification)
}

// pgxExecutor lo cumplen el pool y una transacción.
type pgxExecutor interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}

func upsert(ctx context.Context, db pgxExecutor, notification *domain.Notification) error {
	_, err := db.Exec(ctx, `INSERT INTO notifications
			(id, recipient_id, type, message, property_id, visit_id, created_at, read_at)
		VALUES ($1, $2, $3, $4, NULLIF($5, '')::uuid, NULLIF($6, '')::uuid, $7, $8)
		ON CONFLICT (id) DO UPDATE SET read_at = EXCLUDED.read_at`,
		notification.ID(), notification.RecipientID(), string(notification.Type()), notification.Message(),
		notification.PropertyID(), notification.VisitID(), notification.CreatedAt(), notification.ReadAt())
	if err != nil {
		return fmt.Errorf("guardar el aviso: %w", err)
	}
	return nil
}

// FindByID carga el aggregate.
func (r *Repository) FindByID(ctx context.Context, id string) (*domain.Notification, error) {
	var (
		params domain.ReconstituteParams
		kind   string
	)
	err := r.pool.QueryRow(ctx, `SELECT `+notificationColumns+` FROM notifications WHERE id = $1`, id).Scan(
		&params.ID, &params.RecipientID, &kind, &params.Message,
		&params.PropertyID, &params.VisitID, &params.CreatedAt, &params.ReadAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotificationNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("buscar el aviso: %w", err)
	}
	params.Type = domain.NotificationType(kind)
	params.CreatedAt = params.CreatedAt.UTC()
	params.ReadAt = inUTC(params.ReadAt)
	return domain.Reconstitute(params), nil
}

// ListByRecipient es del lado consulta: lee directo, sin pasar por el aggregate.
func (r *Repository) ListByRecipient(ctx context.Context, query application.ListNotificationsQuery) ([]application.NotificationView, int, error) {
	const filter = ` FROM notifications WHERE recipient_id = $1 AND ($2 = false OR read_at IS NULL)`

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT count(*)`+filter, query.UserID, query.UnreadOnly).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("contar los avisos: %w", err)
	}

	rows, err := r.pool.Query(ctx, `SELECT `+notificationColumns+filter+`
		ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
		query.UserID, query.UnreadOnly, query.Size, (query.Page-1)*query.Size)
	if err != nil {
		return nil, 0, fmt.Errorf("listar los avisos: %w", err)
	}
	views, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (application.NotificationView, error) {
		var (
			view        application.NotificationView
			recipientID string
		)
		err := row.Scan(&view.ID, &recipientID, &view.Type, &view.Message,
			&view.PropertyID, &view.VisitID, &view.CreatedAt, &view.ReadAt)
		view.CreatedAt = view.CreatedAt.UTC()
		view.ReadAt = inUTC(view.ReadAt)
		return view, err
	})
	if err != nil {
		return nil, 0, fmt.Errorf("leer los avisos: %w", err)
	}
	return views, total, nil
}

// inUTC evita que la zona horaria de la conexión se filtre a la API.
func inUTC(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	utc := value.UTC()
	return &utc
}
