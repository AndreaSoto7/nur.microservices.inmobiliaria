// Package balancer elige a qué réplica sana enviar cada request.
package balancer

import (
	"sync"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/discovery"
)

// InstanceSource entrega las réplicas sanas de un servicio. La implementa discovery.Client.
type InstanceSource interface {
	Instances(service string) []discovery.Instance
}

// Strategy es el algoritmo de balanceo. candidates nunca está vacío.
type Strategy interface {
	Next(service string, candidates []discovery.Instance) discovery.Instance
}

// Balancer combina el algoritmo con el Circuit Breaker por réplica: una réplica que falla queda fuera
// un tiempo aunque Consul todavía la reporte sana, porque su health check tarda hasta 10 s en notarlo.
type Balancer struct {
	source   InstanceSource
	strategy Strategy
	downFor  time.Duration
	now      func() time.Time

	mu        sync.RWMutex
	downUntil map[string]time.Time
}

// New recibe el reloj para que los tests no dependan de la hora real.
func New(source InstanceSource, strategy Strategy, downFor time.Duration, now func() time.Time) *Balancer {
	return &Balancer{
		source:    source,
		strategy:  strategy,
		downFor:   downFor,
		now:       now,
		downUntil: make(map[string]time.Time),
	}
}

// Pick elige una réplica disponible del servicio. Sin réplicas devuelve false, y eso termina en 503.
func (b *Balancer) Pick(service string) (discovery.Instance, bool) {
	candidates := b.available(b.source.Instances(service))
	if len(candidates) == 0 {
		return discovery.Instance{}, false
	}
	return b.strategy.Next(service, candidates), true
}

// MarkDown saca a la réplica del balanceo durante downFor. Pasado ese tiempo vuelve a recibir tráfico
// (medio abierto): si sigue fallando, la próxima falla la vuelve a marcar.
func (b *Balancer) MarkDown(instance discovery.Instance) {
	now := b.now()

	b.mu.Lock()
	defer b.mu.Unlock()
	for address, until := range b.downUntil {
		if !now.Before(until) {
			delete(b.downUntil, address)
		}
	}
	b.downUntil[instance.Address] = now.Add(b.downFor)
}

func (b *Balancer) available(instances []discovery.Instance) []discovery.Instance {
	now := b.now()

	b.mu.RLock()
	defer b.mu.RUnlock()
	candidates := make([]discovery.Instance, 0, len(instances))
	for _, instance := range instances {
		if until, marked := b.downUntil[instance.Address]; !marked || !now.Before(until) {
			candidates = append(candidates, instance)
		}
	}
	return candidates
}

func (b *Balancer) markedCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.downUntil)
}
