// Package config lee la configuración del gateway desde variables de entorno.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// defaultMaxImageBodyBytes coincide con listing: 5 imágenes de 5 MB por request, más el multipart.
const defaultMaxImageBodyBytes = 26 << 20

// Config es la configuración del gateway ya validada.
type Config struct {
	Port                   string
	ConsulAddr             string
	DiscoveryInterval      time.Duration
	CORSOrigins            []string
	JWTIssuer              string
	JWTAudience            string
	RateLimitAuthPerMinute int
	UpstreamTimeout        time.Duration
	ReplicaDownDuration    time.Duration
	MaxImageBodyBytes      int64
	AuthReadTimeout        time.Duration
}

// Load valida todas las variables y devuelve juntos todos los errores, para corregirlos de una vez.
func Load(getenv func(string) string) (Config, error) {
	r := reader{getenv: getenv}

	cfg := Config{
		Port:                   r.port("GATEWAY_PORT", "8080"),
		ConsulAddr:             r.httpURL("CONSUL_HTTP_ADDR", "http://consul:8500"),
		DiscoveryInterval:      r.duration("DISCOVERY_REFRESH_INTERVAL", 5*time.Second),
		CORSOrigins:            r.origins("CORS_ALLOWED_ORIGINS", "http://localhost:5173"),
		JWTIssuer:              r.text("JWT_ISSUER", "identity-service"),
		JWTAudience:            r.text("JWT_AUDIENCE", "inmobiliaria"),
		RateLimitAuthPerMinute: int(r.positiveInt("RATE_LIMIT_AUTH_PER_MINUTE", 10)),
		UpstreamTimeout:        r.duration("UPSTREAM_TIMEOUT", 10*time.Second),
		ReplicaDownDuration:    r.duration("REPLICA_DOWN_DURATION", 30*time.Second),
		MaxImageBodyBytes:      r.positiveInt("MAX_BODY_BYTES", defaultMaxImageBodyBytes),
		AuthReadTimeout:        r.duration("AUTH_READ_TIMEOUT", 5*time.Second),
	}

	if err := errors.Join(r.errs...); err != nil {
		return Config{}, fmt.Errorf("configuración inválida: %w", err)
	}
	return cfg, nil
}

type reader struct {
	getenv func(string) string
	errs   []error
}

func (r *reader) fail(key, value, reason string) {
	r.errs = append(r.errs, fmt.Errorf("%s=%q: %s", key, value, reason))
}

func (r *reader) text(key, fallback string) string {
	if value := r.getenv(key); value != "" {
		return value
	}
	return fallback
}

func (r *reader) port(key, fallback string) string {
	value := r.text(key, fallback)
	if n, err := strconv.Atoi(value); err != nil || n < 1 || n > 65535 {
		r.fail(key, value, "debe ser un puerto entre 1 y 65535")
	}
	return value
}

func (r *reader) httpURL(key, fallback string) string {
	value := r.text(key, fallback)
	u, err := url.Parse(value)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		r.fail(key, value, "debe ser una URL http(s)")
	}
	return value
}

func (r *reader) duration(key string, fallback time.Duration) time.Duration {
	raw := r.getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := time.ParseDuration(raw)
	if err != nil || value <= 0 {
		r.fail(key, raw, "debe ser una duración positiva, por ejemplo 5s")
	}
	return value
}

func (r *reader) positiveInt(key string, fallback int64) int64 {
	raw := r.getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		r.fail(key, raw, "debe ser un entero positivo")
	}
	return value
}

// origins exige orígenes completos: la comparación de CORS es exacta y nunca admite comodines.
func (r *reader) origins(key, fallback string) []string {
	raw := r.text(key, fallback)
	var origins []string
	for _, item := range strings.Split(raw, ",") {
		origin := strings.TrimSpace(item)
		if !isOrigin(origin) {
			r.fail(key, origin, "cada origen debe ser esquema://host[:puerto]")
			continue
		}
		origins = append(origins, origin)
	}
	return origins
}

func isOrigin(value string) bool {
	u, err := url.Parse(value)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return false
	}
	return u.Path == "" && u.RawQuery == "" && u.Fragment == "" && u.User == nil
}
