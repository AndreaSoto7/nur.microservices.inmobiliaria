package kafka

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	segmentio "github.com/segmentio/kafka-go"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/domain"
)

const (
	eventID  = "1b2c3d4e-5f60-4a1b-9c2d-3e4f5a6b7c8d"
	userID   = "6f1c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01"
	agentID  = "7a2d3b8f-2c3e-4d9f-8a21-6b7c8d9e0f12"
	property = "3f6c2a7e-1b2d-4c8e-9f10-5a6b7c8d9e01"
	visit    = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
)

func eventValue(eventType string, version int, payload string) []byte {
	return []byte(fmt.Sprintf(`{"eventId":%q,"eventType":%q,"eventVersion":%d,"occurredAt":"2026-11-06T12:00:00Z",
		"producer":"x","aggregateType":"x","aggregateId":"x","correlationId":"abc","payload":%s}`, eventID, eventType, version, payload))
}

func userRegistered() segmentio.Message {
	payload := fmt.Sprintf(`{"userId":%q,"email":"persona@example.com","fullName":"Persona Real","roles":["CLIENT"],"registeredAt":"2026-11-06T12:00:00Z"}`, userID)
	return segmentio.Message{Topic: "identity.user.events", Key: []byte(userID), Value: eventValue("UserRegistered", 1, payload)}
}

// fakeReader entrega los mensajes en orden y cancela cuando no quedan.
type fakeReader struct {
	mu        sync.Mutex
	messages  []segmentio.Message
	committed []segmentio.Message
	fetchErrs []error
	cancel    context.CancelFunc
	commitErr error
}

func (r *fakeReader) FetchMessage(ctx context.Context) (segmentio.Message, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.fetchErrs) > 0 {
		err := r.fetchErrs[0]
		r.fetchErrs = r.fetchErrs[1:]
		return segmentio.Message{}, err
	}
	if len(r.messages) == 0 {
		r.cancel()
		return segmentio.Message{}, ctx.Err()
	}
	message := r.messages[0]
	r.messages = r.messages[1:]
	return message, nil
}

func (r *fakeReader) CommitMessages(_ context.Context, messages ...segmentio.Message) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.committed = append(r.committed, messages...)
	return r.commitErr
}

type fakeDLQ struct {
	written  []segmentio.Message
	failures int
}

func (d *fakeDLQ) WriteMessages(_ context.Context, messages ...segmentio.Message) error {
	if d.failures > 0 {
		d.failures--
		return errors.New("kafka caído")
	}
	d.written = append(d.written, messages...)
	return nil
}

type policyCall struct {
	name string
	args []string
}

// fakePolicies falla las primeras veces según errs.
type fakePolicies struct {
	calls  []policyCall
	errs   []error
	onCall func()
}

func (p *fakePolicies) record(name string, args ...string) error {
	p.calls = append(p.calls, policyCall{name, args})
	if p.onCall != nil {
		p.onCall()
	}
	if len(p.errs) == 0 {
		return nil
	}
	err := p.errs[0]
	p.errs = p.errs[1:]
	return err
}

func (p *fakePolicies) OnUserRegistered(_ context.Context, event, user string) error {
	return p.record("OnUserRegistered", event, user)
}

func (p *fakePolicies) OnVisitRequested(_ context.Context, event, agent, propertyID, visitID string) error {
	return p.record("OnVisitRequested", event, agent, propertyID, visitID)
}

func (p *fakePolicies) OnPropertyReserved(_ context.Context, event, agent, propertyID, actor string) error {
	return p.record("OnPropertyReserved", event, agent, propertyID, actor)
}

func (p *fakePolicies) OnInquiryReceived(_ context.Context, event, agent, propertyID string) error {
	return p.record("OnInquiryReceived", event, agent, propertyID)
}

func (p *fakePolicies) OnVisitScheduled(_ context.Context, event, client, propertyID, visitID string) error {
	return p.record("OnVisitScheduled", event, client, propertyID, visitID)
}

func (p *fakePolicies) OnVisitRejected(_ context.Context, event, client, propertyID, visitID string) error {
	return p.record("OnVisitRejected", event, client, propertyID, visitID)
}

func (p *fakePolicies) OnVisitCancelled(_ context.Context, event, client, agent, propertyID, visitID, actor string) error {
	return p.record("OnVisitCancelled", event, client, agent, propertyID, visitID, actor)
}

func (p *fakePolicies) OnVisitCompleted(_ context.Context, event, client, propertyID, visitID string) error {
	return p.record("OnVisitCompleted", event, client, propertyID, visitID)
}

type harness struct {
	reader   *fakeReader
	dlq      *fakeDLQ
	policies *fakePolicies
	log      *strings.Builder
}

func run(t *testing.T, h *harness) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	h.reader.cancel = cancel
	consumer := NewConsumer(h.reader, h.dlq, h.policies, slog.New(slog.NewJSONHandler(h.log, nil)))
	consumer.retryDelay = time.Microsecond
	done := make(chan struct{})
	go func() {
		consumer.Run(ctx)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run no terminó")
	}
}

func newHarness(messages ...segmentio.Message) *harness {
	return &harness{reader: &fakeReader{messages: messages}, dlq: &fakeDLQ{}, policies: &fakePolicies{}, log: &strings.Builder{}}
}

func TestEachEventReachesItsPolicyAndIsCommitted(t *testing.T) {
	tests := []struct {
		name     string
		message  segmentio.Message
		wantCall policyCall
	}{
		{"UserRegistered", userRegistered(), policyCall{"OnUserRegistered", []string{eventID, userID}}},
		{"VisitRequested", segmentio.Message{Topic: "visit.visit.events", Value: eventValue("VisitRequested", 1,
			fmt.Sprintf(`{"visitId":%q,"propertyId":%q,"clientId":%q,"agentId":%q,"proposedAt":"2026-11-07T10:00:00Z"}`, visit, property, userID, agentID))},
			policyCall{"OnVisitRequested", []string{eventID, agentID, property, visit}}},
		{"PropertyReserved", segmentio.Message{Topic: "listing.property.events", Value: eventValue("PropertyReserved", 1,
			fmt.Sprintf(`{"propertyId":%q,"agentId":%q,"status":"RESERVED","actor":"SYSTEM"}`, property, agentID))},
			policyCall{"OnPropertyReserved", []string{eventID, agentID, property, "SYSTEM"}}},
		{"InquiryReceived", segmentio.Message{Topic: "visit.inquiry.events", Value: eventValue("InquiryReceived", 1,
			fmt.Sprintf(`{"inquiryId":%q,"propertyId":%q,"clientId":%q,"agentId":%q}`, visit, property, userID, agentID))},
			policyCall{"OnInquiryReceived", []string{eventID, agentID, property}}},
		{"VisitScheduled", segmentio.Message{Topic: "visit.visit.events", Value: eventValue("VisitScheduled", 1,
			fmt.Sprintf(`{"visitId":%q,"propertyId":%q,"clientId":%q,"agentId":%q,"scheduledStart":"2026-11-07T10:00:00Z","scheduledEnd":"2026-11-07T11:00:00Z"}`, visit, property, userID, agentID))},
			policyCall{"OnVisitScheduled", []string{eventID, userID, property, visit}}},
		{"VisitRejected", segmentio.Message{Topic: "visit.visit.events", Value: eventValue("VisitRejected", 1,
			fmt.Sprintf(`{"visitId":%q,"propertyId":%q,"clientId":%q,"agentId":%q,"actor":"AGENT","reason":"motivo privado"}`, visit, property, userID, agentID))},
			policyCall{"OnVisitRejected", []string{eventID, userID, property, visit}}},
		{"VisitCancelled", segmentio.Message{Topic: "visit.visit.events", Value: eventValue("VisitCancelled", 1,
			fmt.Sprintf(`{"visitId":%q,"propertyId":%q,"clientId":%q,"agentId":%q,"actor":"CLIENT","reason":null}`, visit, property, userID, agentID))},
			policyCall{"OnVisitCancelled", []string{eventID, userID, agentID, property, visit, "CLIENT"}}},
		{"VisitCompleted", segmentio.Message{Topic: "visit.visit.events", Value: eventValue("VisitCompleted", 1,
			fmt.Sprintf(`{"visitId":%q,"propertyId":%q,"clientId":%q,"agentId":%q,"completedAt":"2026-11-07T11:00:00Z"}`, visit, property, userID, agentID))},
			policyCall{"OnVisitCompleted", []string{eventID, userID, property, visit}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newHarness(tt.message)

			run(t, h)

			if len(h.policies.calls) != 1 || h.policies.calls[0].name != tt.wantCall.name || !slices.Equal(h.policies.calls[0].args, tt.wantCall.args) {
				t.Errorf("llamadas = %+v, want %+v", h.policies.calls, tt.wantCall)
			}
			if len(h.reader.committed) != 1 {
				t.Errorf("commits = %d", len(h.reader.committed))
			}
			if len(h.dlq.written) != 0 {
				t.Errorf("DLQ = %d", len(h.dlq.written))
			}
		})
	}
}

// Agregar eventos o versiones a un topic no debe romper a este consumidor.
func TestUnknownEventsAndVersionsAreIgnoredAndCommitted(t *testing.T) {
	tests := []struct {
		name  string
		value []byte
	}{
		{"tipo desconocido", eventValue("PropertySold", 1, `{}`)},
		{"versión desconocida", eventValue("UserRegistered", 2, `{"userId":"x"}`)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newHarness(segmentio.Message{Topic: "x", Value: tt.value})

			run(t, h)

			if len(h.policies.calls) != 0 || len(h.dlq.written) != 0 {
				t.Errorf("llamadas = %d, DLQ = %d", len(h.policies.calls), len(h.dlq.written))
			}
			if len(h.reader.committed) != 1 {
				t.Errorf("commits = %d", len(h.reader.committed))
			}
		})
	}
}

func TestUnreadableMessagesGoToTheDLQWithoutRetrying(t *testing.T) {
	tests := []struct {
		name  string
		value []byte
	}{
		{"no es JSON", []byte("no es json")},
		{"sin eventId", []byte(`{"eventType":"UserRegistered","eventVersion":1,"payload":{}}`)},
		{"eventId que no es UUID", []byte(`{"eventId":"abc","eventType":"UserRegistered","eventVersion":1,"payload":{}}`)},
		{"payload de otro tipo", eventValue("UserRegistered", 1, `"texto"`)},
		{"sin eventType", []byte(fmt.Sprintf(`{"eventId":%q,"eventVersion":1,"payload":{}}`, eventID))},
		{"sin eventVersion", []byte(fmt.Sprintf(`{"eventId":%q,"eventType":"UserRegistered","payload":{}}`, eventID))},
		{"eventId con prefijo urn", []byte(fmt.Sprintf(`{"eventId":"urn:uuid:%s","eventType":"UserRegistered","eventVersion":1,"payload":{}}`, eventID))},
		{"eventId sin guiones", []byte(`{"eventId":"1b2c3d4e5f604a1b9c2d3e4f5a6b7c8d","eventType":"UserRegistered","eventVersion":1,"payload":{}}`)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newHarness(segmentio.Message{Topic: "identity.user.events", Key: []byte("k"), Value: tt.value})

			run(t, h)

			if len(h.policies.calls) != 0 {
				t.Errorf("llamadas = %d", len(h.policies.calls))
			}
			assertDeadLettered(t, h, "identity.user.events.dlq", tt.value)
		})
	}
}

func assertDeadLettered(t *testing.T, h *harness, topic string, value []byte) {
	t.Helper()
	if len(h.dlq.written) != 1 {
		t.Fatalf("DLQ = %d, want 1", len(h.dlq.written))
	}
	written := h.dlq.written[0]
	if written.Topic != topic || string(written.Value) != string(value) {
		t.Errorf("DLQ = %s %s", written.Topic, written.Value)
	}
	if !slices.ContainsFunc(written.Headers, func(header segmentio.Header) bool { return header.Key == "error" && len(header.Value) > 0 }) {
		t.Errorf("DLQ sin el error: %+v", written.Headers)
	}
	if len(h.reader.committed) != 1 {
		t.Errorf("commits = %d: el consumidor debe seguir con el próximo", len(h.reader.committed))
	}
}

func TestInvalidDataFromThePolicyGoesToTheDLQWithoutRetrying(t *testing.T) {
	message := userRegistered()
	h := newHarness(message)
	h.policies.errs = []error{fmt.Errorf("crear: %w", domain.ErrInvalidNotification)}

	run(t, h)

	if len(h.policies.calls) != 1 {
		t.Errorf("intentos = %d, want 1: reintentar no lo arregla", len(h.policies.calls))
	}
	assertDeadLettered(t, h, "identity.user.events.dlq", message.Value)
}

// El error técnico puede citar valores del mensaje: el motivo que queda en Kafka es fijo, y el detalle va al log.
func TestDeadLetterHeadersAreFixedAndTraceable(t *testing.T) {
	message := userRegistered()
	message.Partition, message.Offset = 2, 41
	h := newHarness(message)
	failure := errors.New(`invalid input syntax for type uuid: "valor-del-mensaje"`)
	h.policies.errs = []error{failure, failure, failure}

	run(t, h)

	if len(h.dlq.written) != 1 {
		t.Fatalf("DLQ = %d", len(h.dlq.written))
	}
	headers := map[string]string{}
	for _, header := range h.dlq.written[0].Headers {
		headers[header.Key] = string(header.Value)
	}
	if strings.Contains(headers["error"], "valor-del-mensaje") {
		t.Errorf("error = %q: expone el error técnico", headers["error"])
	}
	want := map[string]string{"originalTopic": "identity.user.events", "originalPartition": "2", "originalOffset": "41"}
	for key, value := range want {
		if headers[key] != value {
			t.Errorf("%s = %q, want %q", key, headers[key], value)
		}
	}
	if !strings.Contains(h.log.String(), "valor-del-mensaje") {
		t.Error("el detalle del error debe quedar en el log, para diagnosticar")
	}
}

func TestTechnicalErrorIsRetriedAndThenSucceeds(t *testing.T) {
	h := newHarness(userRegistered())
	h.policies.errs = []error{errors.New("base caída"), errors.New("base caída")}

	run(t, h)

	if len(h.policies.calls) != 3 {
		t.Errorf("intentos = %d, want 3", len(h.policies.calls))
	}
	if len(h.dlq.written) != 0 || len(h.reader.committed) != 1 {
		t.Errorf("DLQ = %d, commits = %d", len(h.dlq.written), len(h.reader.committed))
	}
}

func TestTechnicalErrorGoesToTheDLQAfterThreeAttempts(t *testing.T) {
	message := userRegistered()
	h := newHarness(message, message)
	failure := errors.New("base caída")
	h.policies.errs = []error{failure, failure, failure}

	run(t, h)

	if len(h.policies.calls) != 4 {
		t.Errorf("llamadas = %d, want 3 del primero y 1 del segundo: no debe quedarse en un loop", len(h.policies.calls))
	}
	if len(h.dlq.written) != 1 || len(h.reader.committed) != 2 {
		t.Errorf("DLQ = %d, commits = %d", len(h.dlq.written), len(h.reader.committed))
	}
}

// Sin commit, otra réplica lo vuelve a leer al reiniciar: apagar no debe perder ni desviar el mensaje.
func TestShutdownDuringRetriesNeitherCommitsNorDeadLetters(t *testing.T) {
	h := newHarness(userRegistered())
	h.policies.errs = []error{errors.New("base caída"), errors.New("base caída"), errors.New("base caída")}
	h.policies.onCall = func() { h.reader.cancel() }

	run(t, h)

	if len(h.reader.committed) != 0 || len(h.dlq.written) != 0 {
		t.Errorf("commits = %d, DLQ = %d", len(h.reader.committed), len(h.dlq.written))
	}
}

// Si no se pudo escribir en la DLQ, confirmar perdería el mensaje.
func TestDLQFailureRetriesBeforeCommitting(t *testing.T) {
	h := newHarness(segmentio.Message{Topic: "x", Value: []byte("no es json")})
	h.dlq.failures = 2

	run(t, h)

	if len(h.dlq.written) != 1 || len(h.reader.committed) != 1 {
		t.Errorf("DLQ = %d, commits = %d", len(h.dlq.written), len(h.reader.committed))
	}
}

func TestFetchErrorDoesNotStopTheConsumer(t *testing.T) {
	h := newHarness(userRegistered())
	h.reader.fetchErrs = []error{errors.New("rebalanceo")}

	run(t, h)

	if len(h.policies.calls) != 1 {
		t.Errorf("llamadas = %d", len(h.policies.calls))
	}
}

func TestCommitErrorDoesNotStopTheConsumer(t *testing.T) {
	message := userRegistered()
	h := newHarness(message, message)
	h.reader.commitErr = errors.New("rebalanceo")

	run(t, h)

	if len(h.policies.calls) != 2 {
		t.Errorf("llamadas = %d", len(h.policies.calls))
	}
}

// El evento lleva email y nombre: el consumidor no los necesita, y no deben llegar a ningún log.
func TestPersonalDataIsNotLogged(t *testing.T) {
	message := userRegistered()
	h := newHarness(message)
	h.policies.errs = []error{fmt.Errorf("crear: %w", domain.ErrInvalidNotification)}

	run(t, h)

	for _, secret := range []string{"persona@example.com", "Persona Real"} {
		if strings.Contains(h.log.String(), secret) {
			t.Errorf("el log contiene %q: %s", secret, h.log.String())
		}
		for _, header := range h.dlq.written[0].Headers {
			if strings.Contains(string(header.Value), secret) {
				t.Errorf("el header %s contiene %q", header.Key, secret)
			}
		}
	}
}

func TestTopicsAreTheOnesInTheCatalog(t *testing.T) {
	want := []string{"identity.user.events", "listing.property.events", "visit.inquiry.events", "visit.visit.events"}

	if !slices.Equal(Topics(), want) {
		t.Errorf("Topics() = %v", Topics())
	}
}
