// Command gateway es el único punto de entrada del cliente a la plataforma (ADR 0002).
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
	"syscall"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/config"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/middleware"
	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/problem"
)

const (
	readHeaderTimeout = 5 * time.Second // evita Slowloris
	// readTimeout cubre el body completo: alcanza para subir una imagen con una conexión lenta.
	readTimeout = 60 * time.Second
	// writeTimeout corre desde que se leyeron los headers: debe superar a readTimeout más la espera
	// del destino, o el gateway no podría escribir su propio 504.
	writeTimeout   = 75 * time.Second
	idleTimeout    = 120 * time.Second
	maxHeaderBytes = 64 << 10
	// shutdownTimeout es menor que los 10 s de docker stop: si no, Docker mata el proceso.
	shutdownTimeout = 8 * time.Second
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("el gateway terminó con error", "error", err)
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

	var listenConfig net.ListenConfig
	listener, err := listenConfig.Listen(ctx, "tcp", ":"+cfg.Port)
	if err != nil {
		return fmt.Errorf("abrir el puerto %s: %w", cfg.Port, err)
	}

	logger.Info("gateway escuchando", "port", cfg.Port)
	return serve(ctx, listener, newHandler(logger))
}

// newHandler atiende /health aquí y no en un http.ServeMux: el mux limpia los paths y responde 301
// ante `..` o `//`, y esos paths deben llegar a la validación del gateway para responder 400.
// /health queda fuera de la cadena: lo llama Docker cada 10 s y llenaría los logs.
func newHandler(logger *slog.Logger) http.Handler {
	notFound := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		problem.Write(w, r, problem.RouteNotFound)
	})
	chain := middleware.Chain(notFound,
		middleware.Recover(logger),
		middleware.CorrelationID,
		middleware.Logging(logger),
		middleware.StripIdentityHeaders,
	)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/health" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"status":"UP"}`))
			return
		}
		chain.ServeHTTP(w, r)
	})
}

// serve atiende hasta que se cancela ctx y después espera a que terminen las requests en curso.
func serve(ctx context.Context, listener net.Listener, handler http.Handler) error {
	server := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
		MaxHeaderBytes:    maxHeaderBytes,
	}

	serveErr := make(chan error, 1)
	go func() { serveErr <- server.Serve(listener) }()

	select {
	case err := <-serveErr:
		return fmt.Errorf("servidor HTTP: %w", err)
	case <-ctx.Done():
	}

	// El contexto de apagado no hereda de ctx, que ya está cancelado.
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
