// Package config lee la configuración del servicio desde variables de entorno.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// Config es la configuración ya validada.
type Config struct {
	ServiceName    string
	ServicePort    int
	ServiceAddress string
	ConsulAddr     string
	DatabaseURL    string
	KafkaBrokers   []string
	JWKSURL        string
	JWTIssuer      string
	JWTAudience    string
}

// Load valida todas las variables y devuelve juntos todos los errores, para corregirlos de una vez.
func Load(getenv func(string) string) (Config, error) {
	r := reader{getenv: getenv}

	cfg := Config{
		ServiceName:    r.text("SERVICE_NAME", "notification-service"),
		ServicePort:    r.port("SERVICE_PORT", "8005"),
		ServiceAddress: getenv("SERVICE_ADDRESS"),
		ConsulAddr:     r.httpURL("CONSUL_HTTP_ADDR", "http://consul:8500"),
		DatabaseURL:    r.required("DATABASE_URL"),
		KafkaBrokers:   r.list("KAFKA_BOOTSTRAP_SERVERS"),
		JWKSURL:        r.httpURL("JWKS_URL", "http://identity-service:8001/api/v1/auth/.well-known/jwks.json"),
		JWTIssuer:      r.text("JWT_ISSUER", "identity-service"),
		JWTAudience:    r.text("JWT_AUDIENCE", "inmobiliaria"),
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

func (r *reader) text(key, fallback string) string {
	if value := r.getenv(key); value != "" {
		return value
	}
	return fallback
}

// required no muestra el valor en el error: DATABASE_URL lleva la contraseña.
func (r *reader) required(key string) string {
	value := r.getenv(key)
	if value == "" {
		r.errs = append(r.errs, fmt.Errorf("%s: es obligatoria", key))
	}
	return value
}

func (r *reader) port(key, fallback string) int {
	value := r.text(key, fallback)
	port, err := strconv.Atoi(value)
	if err != nil || port < 1 || port > 65535 {
		r.errs = append(r.errs, fmt.Errorf("%s=%q: debe ser un puerto entre 1 y 65535", key, value))
	}
	return port
}

func (r *reader) httpURL(key, fallback string) string {
	value := r.text(key, fallback)
	parsed, err := url.Parse(value)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		r.errs = append(r.errs, fmt.Errorf("%s=%q: debe ser una URL http(s)", key, value))
	}
	return value
}

func (r *reader) list(key string) []string {
	var items []string
	for item := range strings.SplitSeq(r.required(key), ",") {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			items = append(items, trimmed)
		}
	}
	return items
}
