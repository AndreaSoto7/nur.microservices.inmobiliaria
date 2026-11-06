package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
)

// ReadinessCheck revisa las dependencias del servicio.
type ReadinessCheck func(ctx context.Context) error

// Dependencies es lo que la API necesita del resto del servicio.
type Dependencies struct {
	Logger    *slog.Logger
	Ready     ReadinessCheck
	Validator TokenValidator
	List      ListUseCase
	MarkRead  MarkReadUseCase
}

// NewRouter arma las rutas de la API.
func NewRouter(deps Dependencies) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", health)
	mux.HandleFunc("GET /health/ready", readiness(deps))
	mux.HandleFunc("GET /api/v1/notifications", requireUser(deps, listNotifications(deps)))
	mux.HandleFunc("PATCH /api/v1/notifications/{notificationId}", requireUser(deps, markNotificationRead(deps)))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeProblem(w, r, problemNotFound)
	})
	return withMiddleware(deps.Logger, mux)
}

// health es el check de Consul: no depende de la base, para que un parpadeo no saque a todas las réplicas.
func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthBody{Status: "UP"})
}

func readiness(deps Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := deps.Ready(r.Context()); err != nil {
			deps.Logger.Warn("el servicio no está listo", "error", err)
			writeJSON(w, http.StatusServiceUnavailable, healthBody{Status: "DOWN"})
			return
		}
		writeJSON(w, http.StatusOK, healthBody{Status: "UP"})
	}
}

type healthBody struct {
	Status string `json:"status"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
