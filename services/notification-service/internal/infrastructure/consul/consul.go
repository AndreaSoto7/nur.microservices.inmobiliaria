// Package consul registra el servicio en Consul (Self-Registration, rule service-discovery).
package consul

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const requestTimeout = 3 * time.Second

// Service son los datos con los que se registra esta réplica.
type Service struct {
	ID      string
	Name    string
	Address string
	Port    int
}

// Registrar registra y da de baja a la réplica.
type Registrar struct {
	baseURL string
	service Service
	http    *http.Client
	logger  *slog.Logger
}

// NewRegistrar arma el registrador.
func NewRegistrar(consulAddr string, service Service, logger *slog.Logger) *Registrar {
	return &Registrar{
		baseURL: strings.TrimRight(consulAddr, "/"),
		service: service,
		http:    &http.Client{Timeout: requestTimeout},
		logger:  logger,
	}
}

// La API de Consul usa PascalCase: es una API externa, y la convención camelCase del proyecto no aplica.
type registration struct {
	ID      string `json:"ID"`
	Name    string `json:"Name"`
	Address string `json:"Address"`
	Port    int    `json:"Port"`
	Check   check  `json:"Check"`
}

type check struct {
	HTTP                           string `json:"HTTP"`
	Interval                       string `json:"Interval"`
	Timeout                        string `json:"Timeout"`
	DeregisterCriticalServiceAfter string `json:"DeregisterCriticalServiceAfter"`
}

// Register registra la réplica. El PUT es idempotente.
func (r *Registrar) Register(ctx context.Context) error {
	body, err := json.Marshal(registration{
		ID:      r.service.ID,
		Name:    r.service.Name,
		Address: r.service.Address,
		Port:    r.service.Port,
		Check: check{
			HTTP:                           "http://" + net.JoinHostPort(r.service.Address, strconv.Itoa(r.service.Port)) + "/health",
			Interval:                       "10s",
			Timeout:                        "2s",
			DeregisterCriticalServiceAfter: "1m",
		},
	})
	if err != nil {
		return fmt.Errorf("armar el registro: %w", err)
	}
	return r.put(ctx, "/v1/agent/service/register", bytes.NewReader(body))
}

// Deregister da de baja a la réplica.
func (r *Registrar) Deregister(ctx context.Context) error {
	return r.put(ctx, "/v1/agent/service/deregister/"+url.PathEscape(r.service.ID), nil)
}

// Run registra de inmediato y repite cada interval hasta que se cancele ctx. Es obligatorio repetir:
// Consul en modo dev guarda todo en memoria y puede haber borrado una réplica que estuvo crítica. Un
// fallo solo se loguea: sin Consul, el servicio igual debe arrancar.
func (r *Registrar) Run(ctx context.Context, interval time.Duration) {
	r.registerLogging(ctx)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.registerLogging(ctx)
		}
	}
}

func (r *Registrar) registerLogging(ctx context.Context) {
	if err := r.Register(ctx); err != nil && ctx.Err() == nil {
		r.logger.Warn("no se pudo registrar en Consul; se reintenta", "error", err)
	}
}

func (r *Registrar) put(ctx context.Context, path string, body io.Reader) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, r.baseURL+path, body)
	if err != nil {
		return fmt.Errorf("armar la request a Consul: %w", err)
	}
	resp, err := r.http.Do(req)
	if err != nil {
		return fmt.Errorf("llamar a Consul: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("llamar a Consul: status %d", resp.StatusCode)
	}
	return nil
}

// ContainerAddress resuelve la IP con la que se registra la réplica. Nunca loopback: Consul y el
// gateway no podrían llegar. override se usa solo para depurar fuera de Docker.
func ContainerAddress(override, hostname string, lookup func(string) ([]string, error)) (string, error) {
	if override != "" {
		return override, nil
	}
	addresses, err := lookup(hostname)
	if err != nil {
		return "", fmt.Errorf("resolver el hostname: %w", err)
	}
	var fallback string
	for _, address := range addresses {
		ip := net.ParseIP(address)
		if ip == nil || ip.IsLoopback() {
			continue
		}
		if ip.To4() != nil {
			return address, nil
		}
		fallback = address
	}
	if fallback == "" {
		return "", errors.New("el hostname no tiene una IP alcanzable")
	}
	return fallback, nil
}
