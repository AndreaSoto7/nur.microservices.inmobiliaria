// Package discovery consulta en Consul las réplicas sanas de cada servicio (Service Registry).
package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"net"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

const (
	consulRequestTimeout = 3 * time.Second
	maxConsulResponse    = 1 << 20
)

// Instance es una réplica sana de un servicio.
type Instance struct {
	// Address es host:puerto, lista para usar en una URL.
	Address string
}

type consulNode struct {
	Address string `json:"Address"`
}

type consulService struct {
	Address string `json:"Address"`
	Port    int    `json:"Port"`
}

type healthEntry struct {
	Node    consulNode    `json:"Node"`
	Service consulService `json:"Service"`
}

// Client guarda en memoria las réplicas sanas. Las requests leen el snapshot sin bloquearse y sin
// depender de que Consul responda en ese momento.
type Client struct {
	baseURL  string
	services []string
	http     *http.Client
	logger   *slog.Logger
	snapshot atomic.Pointer[map[string][]Instance]
}

// NewClient recibe los nombres de los servicios a consultar (los de la tabla de rutas).
func NewClient(consulAddr string, services []string, logger *slog.Logger) *Client {
	client := &Client{
		baseURL:  strings.TrimRight(consulAddr, "/"),
		services: services,
		http:     &http.Client{Timeout: consulRequestTimeout},
		logger:   logger,
	}
	client.snapshot.Store(&map[string][]Instance{})
	return client
}

// Instances devuelve las réplicas sanas conocidas. La lista es compartida: no se debe modificar.
func (c *Client) Instances(service string) []Instance {
	return (*c.snapshot.Load())[service]
}

// Run consulta de inmediato y después cada interval, hasta que se cancele ctx.
func (c *Client) Run(ctx context.Context, interval time.Duration) {
	c.Refresh(ctx)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.Refresh(ctx)
		}
	}
}

// Refresh actualiza el snapshot. Si falla la consulta de un servicio, conserva sus últimas réplicas:
// es preferible probar una lista algo vieja que dejar sin rutas a todo el sistema porque Consul
// parpadeó. El Circuit Breaker del balanceador cubre las réplicas que ya no existen.
func (c *Client) Refresh(ctx context.Context) {
	next := maps.Clone(*c.snapshot.Load())
	for _, service := range c.services {
		instances, err := c.fetch(ctx, service)
		if err != nil {
			if ctx.Err() == nil {
				c.logger.Warn("no se pudo consultar Consul; se conservan las últimas réplicas",
					"service", service, "error", err)
			}
			continue
		}
		next[service] = instances
	}
	c.snapshot.Store(&next)
}

func (c *Client) fetch(ctx context.Context, service string) ([]Instance, error) {
	target := c.baseURL + "/v1/health/service/" + url.PathEscape(service) + "?passing=true"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, fmt.Errorf("armar la consulta: %w", err)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("consultar: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("consultar: status %d", resp.StatusCode)
	}
	var entries []healthEntry
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxConsulResponse)).Decode(&entries); err != nil {
		return nil, fmt.Errorf("leer la respuesta: %w", err)
	}
	return toInstances(entries), nil
}

// toInstances ordena la lista: el round robin solo reparte parejo si el orden no cambia entre consultas.
func toInstances(entries []healthEntry) []Instance {
	instances := make([]Instance, 0, len(entries))
	for _, entry := range entries {
		host := entry.Service.Address
		if host == "" {
			// Consul documenta este caso: sin dirección propia, el servicio usa la del nodo.
			host = entry.Node.Address
		}
		if host == "" || entry.Service.Port <= 0 {
			continue
		}
		instances = append(instances, Instance{
			Address: net.JoinHostPort(host, strconv.Itoa(entry.Service.Port)),
		})
	}
	slices.SortFunc(instances, func(a, b Instance) int { return strings.Compare(a.Address, b.Address) })
	return instances
}
