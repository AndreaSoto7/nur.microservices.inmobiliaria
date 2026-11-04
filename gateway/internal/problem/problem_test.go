package problem

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteProducesProblemJSONWithCorrelationID(t *testing.T) {
	rec := httptest.NewRecorder()
	rec.Header().Set(CorrelationHeader, "abc-123")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)

	Write(rec, req, RateLimited)

	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("status = %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/problem+json" {
		t.Errorf("Content-Type = %q", got)
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body no es JSON: %v", err)
	}
	want := map[string]any{
		"type":          "https://inmobiliaria.local/problems/gateway-rate-limited",
		"title":         "Demasiadas peticiones",
		"status":        float64(429),
		"detail":        "Espera un momento antes de volver a intentar.",
		"instance":      "/api/v1/auth/login",
		"code":          "GATEWAY_RATE_LIMITED",
		"correlationId": "abc-123",
	}
	for key, value := range want {
		if body[key] != value {
			t.Errorf("%s = %v, want %v", key, body[key], value)
		}
	}
}

// Los códigos son parte del contrato con el frontend: la rule stack-gateway los fija.
func TestKindsMatchTheRuleTable(t *testing.T) {
	tests := []struct {
		kind   Kind
		status int
		code   string
	}{
		{BadRequest, 400, "GATEWAY_BAD_REQUEST"},
		{Unauthorized, 401, "GATEWAY_UNAUTHORIZED"},
		{RouteNotFound, 404, "GATEWAY_ROUTE_NOT_FOUND"},
		{PayloadTooLarge, 413, "GATEWAY_PAYLOAD_TOO_LARGE"},
		{RateLimited, 429, "GATEWAY_RATE_LIMITED"},
		{Internal, 500, "INTERNAL_ERROR"},
		{UpstreamError, 502, "GATEWAY_UPSTREAM_ERROR"},
		{NoHealthyInstance, 503, "GATEWAY_NO_HEALTHY_INSTANCE"},
		{UpstreamTimeout, 504, "GATEWAY_UPSTREAM_TIMEOUT"},
	}

	for _, tt := range tests {
		t.Run(tt.code, func(t *testing.T) {
			if tt.kind.Status != tt.status || tt.kind.Code != tt.code {
				t.Errorf("kind = %d %s, want %d %s", tt.kind.Status, tt.kind.Code, tt.status, tt.code)
			}
			if tt.kind.Title == "" || tt.kind.Detail == "" {
				t.Errorf("%s no tiene title o detail", tt.code)
			}
		})
	}
}
