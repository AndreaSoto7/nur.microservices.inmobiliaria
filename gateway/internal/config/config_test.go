package config

import (
	"slices"
	"strings"
	"testing"
	"time"
)

func envFrom(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestLoadUsesDefaultsFromTheRule(t *testing.T) {
	cfg, err := Load(envFrom(nil))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("Port = %q", cfg.Port)
	}
	if cfg.ConsulAddr != "http://consul:8500" {
		t.Errorf("ConsulAddr = %q", cfg.ConsulAddr)
	}
	if cfg.DiscoveryInterval != 5*time.Second {
		t.Errorf("DiscoveryInterval = %v", cfg.DiscoveryInterval)
	}
	if !slices.Equal(cfg.CORSOrigins, []string{"http://localhost:5173"}) {
		t.Errorf("CORSOrigins = %v", cfg.CORSOrigins)
	}
	if cfg.JWTIssuer != "identity-service" || cfg.JWTAudience != "inmobiliaria" {
		t.Errorf("JWT = %q / %q", cfg.JWTIssuer, cfg.JWTAudience)
	}
	if cfg.RateLimitAuthPerMinute != 10 {
		t.Errorf("RateLimitAuthPerMinute = %d", cfg.RateLimitAuthPerMinute)
	}
	if cfg.UpstreamTimeout != 10*time.Second {
		t.Errorf("UpstreamTimeout = %v", cfg.UpstreamTimeout)
	}
	if cfg.ReplicaDownDuration != 30*time.Second {
		t.Errorf("ReplicaDownDuration = %v", cfg.ReplicaDownDuration)
	}
	if cfg.MaxImageBodyBytes != 10485760 {
		t.Errorf("MaxImageBodyBytes = %d", cfg.MaxImageBodyBytes)
	}
	if cfg.AuthReadTimeout != 5*time.Second {
		t.Errorf("AuthReadTimeout = %v", cfg.AuthReadTimeout)
	}
}

func TestLoadReadsEnvironment(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{
		"GATEWAY_PORT":               "9090",
		"CORS_ALLOWED_ORIGINS":       "http://localhost:5173, https://app.example.com",
		"RATE_LIMIT_AUTH_PER_MINUTE": "3",
		"UPSTREAM_TIMEOUT":           "2s",
	}))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Port != "9090" {
		t.Errorf("Port = %q", cfg.Port)
	}
	want := []string{"http://localhost:5173", "https://app.example.com"}
	if !slices.Equal(cfg.CORSOrigins, want) {
		t.Errorf("CORSOrigins = %v, want %v", cfg.CORSOrigins, want)
	}
	if cfg.RateLimitAuthPerMinute != 3 {
		t.Errorf("RateLimitAuthPerMinute = %d", cfg.RateLimitAuthPerMinute)
	}
	if cfg.UpstreamTimeout != 2*time.Second {
		t.Errorf("UpstreamTimeout = %v", cfg.UpstreamTimeout)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	tests := []struct {
		name, key, value string
	}{
		{"puerto no numérico", "GATEWAY_PORT", "abc"},
		{"puerto fuera de rango", "GATEWAY_PORT", "70000"},
		{"consul sin esquema", "CONSUL_HTTP_ADDR", "consul:8500"},
		{"duración inválida", "DISCOVERY_REFRESH_INTERVAL", "5"},
		{"duración cero", "UPSTREAM_TIMEOUT", "0s"},
		{"duración negativa", "AUTH_READ_TIMEOUT", "-1s"},
		{"CORS con comodín", "CORS_ALLOWED_ORIGINS", "*"},
		{"CORS con null", "CORS_ALLOWED_ORIGINS", "http://localhost:5173,null"},
		{"CORS sin esquema", "CORS_ALLOWED_ORIGINS", "localhost:5173"},
		{"CORS con path", "CORS_ALLOWED_ORIGINS", "http://localhost:5173/app"},
		{"rate limit en cero", "RATE_LIMIT_AUTH_PER_MINUTE", "0"},
		{"rate limit no numérico", "RATE_LIMIT_AUTH_PER_MINUTE", "diez"},
		{"body en cero", "MAX_BODY_BYTES", "0"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Load(envFrom(map[string]string{tt.key: tt.value}))
			if err == nil {
				t.Fatalf("Load() con %s=%q no devolvió error", tt.key, tt.value)
			}
			if !strings.Contains(err.Error(), tt.key) {
				t.Errorf("el error %q no nombra la variable %s", err, tt.key)
			}
		})
	}
}
