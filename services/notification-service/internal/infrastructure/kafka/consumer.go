// Package kafka consume los eventos de otros servicios y los traduce a llamadas a las políticas.
package kafka

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	segmentio "github.com/segmentio/kafka-go"

	"github.com/google/uuid"

	"github.com/AndreaSoto7/nur.microservices.inmobiliaria/services/notification-service/internal/application"
)

const (
	maxAttempts   = 3
	retryDelay    = time.Second
	commitTimeout = 2 * time.Second
	dlqSuffix     = ".dlq"
)

// Topics son los topics que consume el servicio (contracts/events/README.md).
func Topics() []string {
	return []string{"identity.user.events", "listing.property.events", "visit.visit.events"}
}

// Reader lee y confirma mensajes. Lo implementa el Reader de kafka-go.
type Reader interface {
	FetchMessage(ctx context.Context) (segmentio.Message, error)
	CommitMessages(ctx context.Context, messages ...segmentio.Message) error
}

// DeadLetterWriter guarda los mensajes que no se pudieron procesar.
type DeadLetterWriter interface {
	WriteMessages(ctx context.Context, messages ...segmentio.Message) error
}

// Policies son las reacciones a cada evento. Las implementa application.EventPolicies.
type Policies interface {
	OnUserRegistered(ctx context.Context, eventID, userID string) error
	OnVisitRequested(ctx context.Context, eventID, agentID, propertyID, visitID string) error
	OnPropertyReserved(ctx context.Context, eventID, agentID, propertyID, actor string) error
}

// Consumer procesa los mensajes uno por uno, y solo los confirma cuando se procesaron o quedaron en la DLQ.
type Consumer struct {
	reader     Reader
	dlq        DeadLetterWriter
	policies   Policies
	logger     *slog.Logger
	retryDelay time.Duration
}

// NewConsumer arma el consumidor.
func NewConsumer(reader Reader, dlq DeadLetterWriter, policies Policies, logger *slog.Logger) *Consumer {
	return &Consumer{reader: reader, dlq: dlq, policies: policies, logger: logger, retryDelay: retryDelay}
}

// Run consume hasta que se cancele ctx. Un error nunca lo detiene: reintenta o manda a la DLQ y sigue.
func (c *Consumer) Run(ctx context.Context) {
	for {
		message, err := c.reader.FetchMessage(ctx)
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			c.logger.Warn("no se pudo leer de Kafka; se reintenta", "error", err)
			if !c.sleep(ctx, c.retryDelay) {
				return
			}
			continue
		}
		if c.process(ctx, message) {
			c.commit(ctx, message)
		}
	}
}

// process devuelve true si el mensaje ya se puede confirmar. Con false, el servicio se está apagando: sin
// confirmar, el mensaje se vuelve a leer al reiniciar.
func (c *Consumer) process(ctx context.Context, message segmentio.Message) bool {
	event, err := parseEnvelope(message.Value)
	if err != nil {
		return c.deadLetter(ctx, message, "mensaje ilegible: no cumple el envelope")
	}

	handler, known := c.handlerFor(event)
	if !known {
		return true
	}

	for attempt := 1; ; attempt++ {
		err := handler(ctx)
		switch {
		case err == nil:
			return true
		case errors.Is(err, errInvalidPayload):
			return c.deadLetter(ctx, message, "mensaje ilegible: no cumple el schema del evento")
		case application.IsPermanent(err):
			return c.deadLetter(ctx, message, err.Error())
		case attempt >= maxAttempts:
			return c.deadLetter(ctx, message, fmt.Sprintf("agotó %d intentos: %v", maxAttempts, err))
		}
		c.logger.Warn("falló el procesamiento de un evento; se reintenta",
			"eventType", event.EventType, "eventId", event.EventID, "correlationId", event.CorrelationID,
			"attempt", attempt, "error", err)
		if !c.sleep(ctx, time.Duration(attempt)*c.retryDelay) {
			return false
		}
	}
}

// deadLetter insiste hasta poder escribir: confirmar sin haberlo guardado perdería el mensaje. Solo falla
// si Kafka está caído, y entonces tampoco hay mensajes nuevos que atender.
func (c *Consumer) deadLetter(ctx context.Context, message segmentio.Message, reason string) bool {
	dead := segmentio.Message{
		Topic: message.Topic + dlqSuffix,
		Key:   message.Key,
		Value: message.Value,
		Headers: []segmentio.Header{
			{Key: "error", Value: []byte(reason)},
			{Key: "originalTopic", Value: []byte(message.Topic)},
		},
	}
	c.logger.Error("mensaje enviado a la DLQ",
		"topic", message.Topic, "partition", message.Partition, "offset", message.Offset, "reason", reason)
	for {
		err := c.dlq.WriteMessages(ctx, dead)
		if err == nil {
			return true
		}
		c.logger.Warn("no se pudo escribir en la DLQ; se reintenta", "topic", dead.Topic, "error", err)
		if !c.sleep(ctx, c.retryDelay) {
			return false
		}
	}
}

// commit no usa ctx: si se apaga justo después de procesar, conviene igual confirmar lo ya hecho. Si falla,
// el mensaje se relee, y el consumidor es idempotente.
func (c *Consumer) commit(ctx context.Context, message segmentio.Message) {
	commitCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), commitTimeout)
	defer cancel()
	if err := c.reader.CommitMessages(commitCtx, message); err != nil {
		c.logger.Warn("no se pudo confirmar un mensaje; se volverá a leer", "topic", message.Topic, "error", err)
	}
}

func (c *Consumer) sleep(ctx context.Context, duration time.Duration) bool {
	select {
	case <-ctx.Done():
		return false
	case <-time.After(duration):
		return true
	}
}

type envelope struct {
	EventID       string          `json:"eventId"`
	EventType     string          `json:"eventType"`
	EventVersion  int             `json:"eventVersion"`
	CorrelationID string          `json:"correlationId"`
	Payload       json.RawMessage `json:"payload"`
}

func parseEnvelope(value []byte) (envelope, error) {
	var event envelope
	if err := json.Unmarshal(value, &event); err != nil {
		return envelope{}, fmt.Errorf("leer el envelope: %w", err)
	}
	if err := uuid.Validate(event.EventID); err != nil {
		return envelope{}, fmt.Errorf("eventId inválido: %w", err)
	}
	return event, nil
}

var errInvalidPayload = errors.New("payload ilegible")

// handlerFor es el anti-corruption layer: traduce cada evento a una llamada a la política. Filtra por tipo y
// versión, e ignora lo demás. Cada payload lee solo lo que necesita: de UserRegistered, nunca email ni nombre.
func (c *Consumer) handlerFor(event envelope) (func(context.Context) error, bool) {
	const supportedVersion = 1
	if event.EventVersion != supportedVersion {
		return nil, false
	}
	switch event.EventType {
	case "UserRegistered":
		return func(ctx context.Context) error {
			var payload struct {
				UserID string `json:"userId"`
			}
			if err := json.Unmarshal(event.Payload, &payload); err != nil {
				return errInvalidPayload
			}
			return c.policies.OnUserRegistered(ctx, event.EventID, payload.UserID)
		}, true
	case "VisitRequested":
		return func(ctx context.Context) error {
			var payload struct {
				VisitID    string `json:"visitId"`
				PropertyID string `json:"propertyId"`
				AgentID    string `json:"agentId"`
			}
			if err := json.Unmarshal(event.Payload, &payload); err != nil {
				return errInvalidPayload
			}
			return c.policies.OnVisitRequested(ctx, event.EventID, payload.AgentID, payload.PropertyID, payload.VisitID)
		}, true
	case "PropertyReserved":
		return func(ctx context.Context) error {
			var payload struct {
				PropertyID string `json:"propertyId"`
				AgentID    string `json:"agentId"`
				Actor      string `json:"actor"`
			}
			if err := json.Unmarshal(event.Payload, &payload); err != nil {
				return errInvalidPayload
			}
			return c.policies.OnPropertyReserved(ctx, event.EventID, payload.AgentID, payload.PropertyID, payload.Actor)
		}, true
	default:
		return nil, false
	}
}
