package balancer

import (
	"sync"
	"sync/atomic"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/discovery"
)

// RoundRobin reparte en orden, con un contador por servicio. Su valor cero está listo para usar.
type RoundRobin struct {
	counters sync.Map // nombre del servicio → *atomic.Uint64
}

// Next implementa Strategy.
func (r *RoundRobin) Next(service string, candidates []discovery.Instance) discovery.Instance {
	value, _ := r.counters.LoadOrStore(service, &atomic.Uint64{})
	counter, _ := value.(*atomic.Uint64)
	position := (counter.Add(1) - 1) % uint64(len(candidates))
	return candidates[position]
}
