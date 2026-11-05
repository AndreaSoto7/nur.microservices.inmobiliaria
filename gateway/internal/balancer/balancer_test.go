package balancer

import (
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/discovery"
)

const (
	service  = "listing-service"
	downTime = 30 * time.Second
)

type fakeSource map[string][]discovery.Instance

func (f fakeSource) Instances(name string) []discovery.Instance { return f[name] }

type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func newFakeClock() *fakeClock {
	return &fakeClock{now: time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)}
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

func instances(addresses ...string) []discovery.Instance {
	result := make([]discovery.Instance, 0, len(addresses))
	for _, address := range addresses {
		result = append(result, discovery.Instance{Address: address})
	}
	return result
}

func threeReplicas() fakeSource {
	return fakeSource{service: instances("a:1", "b:1", "c:1")}
}

func newBalancer(source fakeSource, clock *fakeClock) *Balancer {
	return New(source, &RoundRobin{}, downTime, clock.Now)
}

func pickN(t *testing.T, b *Balancer, n int) []string {
	t.Helper()
	picked := make([]string, 0, n)
	for range n {
		instance, ok := b.Pick(service)
		if !ok {
			t.Fatal("Pick() no encontró réplica")
		}
		picked = append(picked, instance.Address)
	}
	return picked
}

func TestRoundRobinDistributesInOrder(t *testing.T) {
	b := newBalancer(threeReplicas(), newFakeClock())

	got := pickN(t, b, 7)

	want := []string{"a:1", "b:1", "c:1", "a:1", "b:1", "c:1", "a:1"}
	if !slices.Equal(got, want) {
		t.Errorf("orden = %v, want %v", got, want)
	}
}

func TestRoundRobinKeepsOneCounterPerService(t *testing.T) {
	source := fakeSource{
		"listing-service":  instances("a:1", "b:1"),
		"identity-service": instances("x:1", "y:1"),
	}
	b := newBalancer(source, newFakeClock())

	first, _ := b.Pick("listing-service")
	second, _ := b.Pick("identity-service")

	if first.Address != "a:1" || second.Address != "x:1" {
		t.Errorf("first = %s, second = %s: un servicio movió el contador del otro", first.Address, second.Address)
	}
}

func TestRoundRobinDistributesEvenlyUnderConcurrency(t *testing.T) {
	b := newBalancer(threeReplicas(), newFakeClock())
	var counts [3]atomic.Int64
	index := map[string]int{"a:1": 0, "b:1": 1, "c:1": 2}
	var wg sync.WaitGroup

	for range 30 {
		wg.Go(func() {
			for range 10 {
				instance, _ := b.Pick(service)
				counts[index[instance.Address]].Add(1)
			}
		})
	}
	wg.Wait()

	for i := range counts {
		if got := counts[i].Load(); got != 100 {
			t.Errorf("réplica %d atendió %d, want 100", i, got)
		}
	}
}

func TestPickWithoutReplicasFails(t *testing.T) {
	tests := []struct {
		name   string
		source fakeSource
	}{
		{"servicio desconocido", fakeSource{}},
		{"lista vacía", fakeSource{service: {}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := newBalancer(tt.source, newFakeClock())

			if instance, ok := b.Pick(service); ok {
				t.Errorf("Pick() = %v, want ninguna", instance)
			}
		})
	}
}

func TestMarkedReplicaIsSkippedEvenIfConsulReportsItHealthy(t *testing.T) {
	b := newBalancer(threeReplicas(), newFakeClock())

	b.MarkDown(discovery.Instance{Address: "b:1"})

	for _, address := range pickN(t, b, 6) {
		if address == "b:1" {
			t.Fatal("eligió la réplica marcada como caída")
		}
	}
}

func TestMarkedReplicaComesBackAfterDownTime(t *testing.T) {
	clock := newFakeClock()
	b := newBalancer(threeReplicas(), clock)
	b.MarkDown(discovery.Instance{Address: "b:1"})

	clock.Advance(downTime - time.Second)
	if slices.Contains(pickN(t, b, 6), "b:1") {
		t.Fatal("volvió antes de tiempo")
	}

	clock.Advance(time.Second)
	if !slices.Contains(pickN(t, b, 6), "b:1") {
		t.Error("no volvió a probarse pasado el tiempo")
	}
}

func TestFailingAgainMarksReplicaForAnotherPeriod(t *testing.T) {
	clock := newFakeClock()
	b := newBalancer(threeReplicas(), clock)
	b.MarkDown(discovery.Instance{Address: "b:1"})
	clock.Advance(downTime)

	b.MarkDown(discovery.Instance{Address: "b:1"})

	clock.Advance(downTime - time.Second)
	if slices.Contains(pickN(t, b, 6), "b:1") {
		t.Error("una réplica que vuelve a fallar debe quedar fuera otro período")
	}
}

func TestAllReplicasMarkedMeansNoInstance(t *testing.T) {
	b := newBalancer(threeReplicas(), newFakeClock())
	for _, address := range []string{"a:1", "b:1", "c:1"} {
		b.MarkDown(discovery.Instance{Address: address})
	}

	if instance, ok := b.Pick(service); ok {
		t.Errorf("Pick() = %v, want ninguna: debe terminar en 503", instance)
	}
}

func TestExpiredMarksAreForgotten(t *testing.T) {
	clock := newFakeClock()
	b := newBalancer(threeReplicas(), clock)
	b.MarkDown(discovery.Instance{Address: "a:1"})
	b.MarkDown(discovery.Instance{Address: "b:1"})

	clock.Advance(downTime)
	b.MarkDown(discovery.Instance{Address: "c:1"})

	if got := b.markedCount(); got != 1 {
		t.Errorf("marcas = %d, want 1", got)
	}
}

// fixedStrategy prueba que el balanceador no conoce el algoritmo: otra implementación no lo toca.
type fixedStrategy struct{}

func (fixedStrategy) Next(_ string, candidates []discovery.Instance) discovery.Instance {
	return candidates[len(candidates)-1]
}

func TestStrategyCanBeReplaced(t *testing.T) {
	b := New(threeReplicas(), fixedStrategy{}, downTime, newFakeClock().Now)

	instance, ok := b.Pick(service)

	if !ok || instance.Address != "c:1" {
		t.Errorf("Pick() = %v, %v", instance, ok)
	}
}

func TestStrategyOnlyReceivesAvailableReplicas(t *testing.T) {
	b := New(threeReplicas(), fixedStrategy{}, downTime, newFakeClock().Now)

	b.MarkDown(discovery.Instance{Address: "c:1"})

	if instance, _ := b.Pick(service); instance.Address != "b:1" {
		t.Errorf("Pick() = %v", instance)
	}
}

func TestConcurrentPickAndMarkDown(t *testing.T) {
	b := newBalancer(threeReplicas(), newFakeClock())
	var wg sync.WaitGroup

	for range 20 {
		wg.Go(func() {
			for range 20 {
				if instance, ok := b.Pick(service); ok {
					b.MarkDown(instance)
				}
			}
		})
	}
	wg.Wait()
}
