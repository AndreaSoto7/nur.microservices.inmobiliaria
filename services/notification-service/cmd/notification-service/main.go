// Command notification-service crea avisos para los usuarios a partir de eventos de Kafka (ADR 0007).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/application"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/infrastructure/config"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/infrastructure/consul"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/infrastructure/jwks"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/infrastructure/postgres"
	httpapi "github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/interfaces/http"
)

const (
	readHeaderTimeout = 5 * time.Second
	readTimeout       = 15 * time.Second
	writeTimeout      = 30 * time.Second
	idleTimeout       = 120 * time.Second
	reRegisterEvery   = 60 * time.Second
	startupRetryLimit = 30 * time.Second
	startupRetryEvery = 2 * time.Second
	deregisterTimeout = 2 * time.Second
	// shutdownTimeout más la baja deben quedar bajo los 10 s de docker stop.
	shutdownTimeout = 5 * time.Second
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("el servicio terminó con error", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		// El error de pgx podría incluir partes de la URL, que lleva la contraseña.
		return errors.New("DATABASE_URL no es válida")
	}
	defer pool.Close()
	migrate := func(ctx context.Context) error { return postgres.Migrate(ctx, pool) }
	if err := retryUntil(ctx, startupRetryLimit, startupRetryEvery, migrate); err != nil {
		return fmt.Errorf("preparar la base: %w", err)
	}
	repository := postgres.NewRepository(pool)

	var listenConfig net.ListenConfig
	listener, err := listenConfig.Listen(ctx, "tcp", ":"+strconv.Itoa(cfg.ServicePort))
	if err != nil {
		return fmt.Errorf("abrir el puerto %d: %w", cfg.ServicePort, err)
	}

	stopRegistration := startRegistration(ctx, cfg, logger)
	keys := jwks.NewKeySet(cfg.JWKSURL, time.Now)
	go keys.Run(ctx, jwks.RefreshInterval, logger)
	router := httpapi.NewRouter(httpapi.Dependencies{
		Logger:    logger,
		Ready:     repository.Ping,
		Validator: jwks.NewValidator(keys, cfg.JWTIssuer, cfg.JWTAudience, time.Now),
		List:      application.NewListNotifications(repository),
		MarkRead:  application.NewMarkNotificationRead(repository, time.Now),
	})

	logger.Info("servicio escuchando", "port", cfg.ServicePort)
	return serve(ctx, listener, router, stopRegistration)
}

// retryUntil reintenta mientras la dependencia termina de levantar: el compose espera a que la base esté
// sana, pero fuera de él nadie lo garantiza.
func retryUntil(ctx context.Context, limit, every time.Duration, attempt func(context.Context) error) error {
	deadline := time.Now().Add(limit)
	for {
		err := attempt(ctx)
		if err == nil {
			return nil
		}
		if time.Now().After(deadline) {
			return err
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("arranque cancelado: %w", ctx.Err())
		case <-time.After(every):
		}
	}
}

// startRegistration registra la réplica ya con el listener abierto, para que el primer health check
// encuentre el servidor. Devuelve la limpieza: detiene el ciclo antes de la baja, porque un PUT tardío
// reviviría a una réplica muerta.
func startRegistration(ctx context.Context, cfg config.Config, logger *slog.Logger) func() {
	hostname, err := os.Hostname()
	if err != nil {
		logger.Warn("no se registra en Consul: sin hostname", "error", err)
		return func() {}
	}
	address, err := consul.ContainerAddress(cfg.ServiceAddress, hostname, net.LookupHost)
	if err != nil {
		logger.Warn("no se registra en Consul: sin dirección", "error", err)
		return func() {}
	}

	registrar := consul.NewRegistrar(cfg.ConsulAddr, consul.Service{
		ID:      cfg.ServiceName + "-" + hostname,
		Name:    cfg.ServiceName,
		Address: address,
		Port:    cfg.ServicePort,
	}, logger)
	done := make(chan struct{})
	go func() {
		defer close(done)
		registrar.Run(ctx, reRegisterEvery)
	}()

	return func() {
		<-done
		deregisterCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), deregisterTimeout)
		defer cancel()
		if err := registrar.Deregister(deregisterCtx); err != nil {
			logger.Warn("no se pudo dar de baja en Consul", "error", err)
		}
	}
}

// serve atiende hasta que se cancela ctx. La limpieza corre antes de cerrar el HTTP: mientras Consul
// crea viva a la réplica, debe seguir respondiendo.
func serve(ctx context.Context, listener net.Listener, handler http.Handler, cleanup func()) error {
	server := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}

	serveErr := make(chan error, 1)
	go func() { serveErr <- server.Serve(listener) }()

	select {
	case err := <-serveErr:
		return fmt.Errorf("servidor HTTP: %w", err)
	case <-ctx.Done():
	}

	cleanup()

	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("apagar el servidor: %w", err)
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("servidor HTTP: %w", err)
	}
	return nil
}
