package middleware

import (
	"math"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/gateway/internal/problem"
)

// bucketRefillWindow es lo que tarda en llenarse un bucket vacío: burst = límite por minuto.
const bucketRefillWindow = time.Minute

const ipv6ClientPrefixBits = 64

// limitedPaths son las rutas caras o sensibles: hashear contraseñas consume CPU, y el 401 y el 409
// permitirían probar contraseñas o descubrir qué emails existen.
var limitedPaths = map[string]bool{
	"/api/v1/auth/login":    true,
	"/api/v1/auth/register": true,
}

type clientBucket struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter aplica un token bucket por IP y ruta en login y registro. Guarda el estado en memoria:
// con una sola instancia del gateway alcanza, y evita depender de una base.
type RateLimiter struct {
	refillRate rate.Limit
	burst      int
	retryAfter string
	now        func() time.Time

	mu        sync.Mutex
	buckets   map[string]*clientBucket
	lastSweep time.Time
}

// NewRateLimiter recibe el reloj para que los tests no dependan de la hora real.
func NewRateLimiter(perMinute int, now func() time.Time) *RateLimiter {
	secondsPerToken := bucketRefillWindow.Seconds() / float64(perMinute)
	return &RateLimiter{
		refillRate: rate.Every(bucketRefillWindow / time.Duration(perMinute)),
		burst:      perMinute,
		retryAfter: strconv.Itoa(int(math.Ceil(secondsPerToken))),
		now:        now,
		buckets:    make(map[string]*clientBucket),
		lastSweep:  now(),
	}
}

// Middleware responde 429 cuando el cliente agotó su bucket.
func (l *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// EqualFold: net/http acepta "post" como método, y Django lo atiende igual que POST.
		if strings.EqualFold(r.Method, http.MethodPost) && limitedPaths[r.URL.Path] && !l.allow(clientKey(r)) {
			w.Header().Set("Retry-After", l.retryAfter)
			problem.Write(w, r, problem.RateLimited)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (l *RateLimiter) allow(key string) bool {
	now := l.now()

	l.mu.Lock()
	l.sweep(now)
	bucket, ok := l.buckets[key]
	if !ok {
		bucket = &clientBucket{limiter: rate.NewLimiter(l.refillRate, l.burst)}
		l.buckets[key] = bucket
	}
	bucket.lastSeen = now
	l.mu.Unlock()

	return bucket.limiter.AllowN(now, 1)
}

// sweep corre dentro de allow, sin goroutine propia que apagar. Borra solo los buckets que ya se
// llenaron solos: olvidar uno a medio llenar le regalaría intentos al cliente.
func (l *RateLimiter) sweep(now time.Time) {
	if now.Sub(l.lastSweep) < bucketRefillWindow {
		return
	}
	l.lastSweep = now
	for key, bucket := range l.buckets {
		if now.Sub(bucket.lastSeen) >= bucketRefillWindow {
			delete(l.buckets, key)
		}
	}
}

func (l *RateLimiter) size() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.buckets)
}

// clientKey usa la IP de la conexión, sin el puerto: cada conexión nueva usa otro puerto, y con él en
// la clave el límite no serviría. X-Forwarded-For no se mira porque lo controla el cliente.
func clientKey(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return r.URL.Path + "|" + clientNetwork(host)
}

// clientNetwork agrupa IPv6 por /64: un cliente suele controlar esa red entera, y con la dirección
// completa tendría un bucket nuevo por request.
func clientNetwork(host string) string {
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return host
	}
	addr = addr.Unmap()
	if addr.Is4() {
		return addr.String()
	}
	prefix, err := addr.Prefix(ipv6ClientPrefixBits)
	if err != nil {
		return host
	}
	return prefix.String()
}
