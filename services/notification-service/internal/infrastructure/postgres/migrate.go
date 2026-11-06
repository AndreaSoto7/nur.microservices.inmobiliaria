// Package postgres implementa la persistencia del servicio con pgx.
package postgres

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"slices"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Número arbitrario y fijo: identifica el lock de migraciones de este servicio.
const migrationLock = 7007

//go:embed migrations/*.sql
var migrationFiles embed.FS

// Migrate aplica las migraciones pendientes. El advisory lock deja que varias réplicas arranquen a la vez:
// la segunda espera, y después encuentra todo aplicado.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("conectar para migrar: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", migrationLock); err != nil {
		return fmt.Errorf("tomar el lock de migraciones: %w", err)
	}
	defer func() {
		// Sin este contexto propio, un ctx cancelado dejaría el lock tomado en la conexión del pool.
		_, _ = conn.Exec(context.WithoutCancel(ctx), "SELECT pg_advisory_unlock($1)", migrationLock)
	}()

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY)`); err != nil {
		return fmt.Errorf("crear schema_migrations: %w", err)
	}

	names, err := fs.Glob(migrationFiles, "migrations/*.sql")
	if err != nil {
		return fmt.Errorf("listar las migraciones: %w", err)
	}
	slices.Sort(names)
	for _, name := range names {
		if err := applyMigration(ctx, conn.Conn(), name); err != nil {
			return fmt.Errorf("aplicar %s: %w", name, err)
		}
	}
	return nil
}

func applyMigration(ctx context.Context, conn *pgx.Conn, name string) error {
	sql, err := migrationFiles.ReadFile(name)
	if err != nil {
		return fmt.Errorf("leer: %w", err)
	}
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("abrir la transacción: %w", err)
	}
	defer func() { _ = tx.Rollback(context.WithoutCancel(ctx)) }()

	tag, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING", name)
	if err != nil {
		return fmt.Errorf("registrar: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, string(sql)); err != nil {
		return fmt.Errorf("ejecutar: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("confirmar: %w", err)
	}
	return nil
}
