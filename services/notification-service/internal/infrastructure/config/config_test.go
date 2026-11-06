package config

import (
	"slices"
	"strings"
	"testing"
)

func envFrom(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func validEnv() map[string]string {
	return map[string]string{
		"DATABASE_URL":            "postgres://notification:clave@notification-db:5432/notification",
		"KAFKA_BOOTSTRAP_SERVERS": "kafka:29092",
	}
}

func TestLoadUsesDefaults(t *testing.T) {
	cfg, err := Load(envFrom(validEnv()))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.ServiceName != "notification-service" || cfg.ServicePort != 8005 {
		t.Errorf("servicio = %s:%d", cfg.ServiceName, cfg.ServicePort)
	}
	if cfg.ConsulAddr != "http://consul:8500" {
		t.Errorf("ConsulAddr = %q", cfg.ConsulAddr)
	}
	if cfg.JWKSURL != "http://identity-service:8001/api/v1/auth/.well-known/jwks.json" {
		t.Errorf("JWKSURL = %q", cfg.JWKSURL)
	}
	if cfg.JWTIssuer != "identity-service" || cfg.JWTAudience != "inmobiliaria" {
		t.Errorf("JWT = %s / %s", cfg.JWTIssuer, cfg.JWTAudience)
	}
	if !slices.Equal(cfg.KafkaBrokers, []string{"kafka:29092"}) {
		t.Errorf("KafkaBrokers = %v", cfg.KafkaBrokers)
	}
}

func TestLoadReadsEnvironment(t *testing.T) {
	env := validEnv()
	env["SERVICE_PORT"] = "9000"
	env["SERVICE_ADDRESS"] = "10.0.0.5"
	env["KAFKA_BOOTSTRAP_SERVERS"] = "a:9092, b:9092"

	cfg, err := Load(envFrom(env))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.ServicePort != 9000 || cfg.ServiceAddress != "10.0.0.5" {
		t.Errorf("cfg = %d %s", cfg.ServicePort, cfg.ServiceAddress)
	}
	if !slices.Equal(cfg.KafkaBrokers, []string{"a:9092", "b:9092"}) {
		t.Errorf("KafkaBrokers = %v", cfg.KafkaBrokers)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	tests := []struct {
		name, key, value string
	}{
		{"sin base", "DATABASE_URL", ""},
		{"sin Kafka", "KAFKA_BOOTSTRAP_SERVERS", ""},
		{"puerto no numérico", "SERVICE_PORT", "abc"},
		{"puerto fuera de rango", "SERVICE_PORT", "70000"},
		{"Consul sin esquema", "CONSUL_HTTP_ADDR", "consul:8500"},
		{"JWKS sin esquema", "JWKS_URL", "identity-service/jwks.json"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := validEnv()
			env[tt.key] = tt.value

			_, err := Load(envFrom(env))

			if err == nil {
				t.Fatalf("Load() con %s=%q no devolvió error", tt.key, tt.value)
			}
			if !strings.Contains(err.Error(), tt.key) {
				t.Errorf("el error %q no nombra la variable %s", err, tt.key)
			}
		})
	}
}

// La URL de la base lleva la contraseña: un error de configuración no debe mostrarla en los logs.
func TestLoadDoesNotLeakDatabaseURLInErrors(t *testing.T) {
	env := validEnv()
	env["SERVICE_PORT"] = "abc"

	_, err := Load(envFrom(env))

	if err == nil || strings.Contains(err.Error(), "clave") {
		t.Errorf("error = %v", err)
	}
}
