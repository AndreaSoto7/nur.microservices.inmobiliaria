package kafka

import (
	"fmt"
	"log/slog"
	"time"

	segmentio "github.com/segmentio/kafka-go"
)

const (
	consumerGroup = "notification-service"
	maxWait       = time.Second
	writeTimeout  = 5 * time.Second
)

// NewReader arma el lector real. Arranca desde el principio de cada topic, como los demás consumidores del
// proyecto. CommitInterval en cero: cada mensaje se confirma al procesarlo.
func NewReader(brokers []string, logger *slog.Logger) *segmentio.Reader {
	return segmentio.NewReader(segmentio.ReaderConfig{
		Brokers:     brokers,
		GroupID:     consumerGroup,
		GroupTopics: Topics(),
		StartOffset: segmentio.FirstOffset,
		MaxWait:     maxWait,
		ErrorLogger: segmentio.LoggerFunc(func(format string, args ...any) {
			logger.Warn("error interno del cliente de Kafka", "detail", fmt.Sprintf(format, args...))
		}),
	})
}

// NewDeadLetterWriter arma el escritor de la DLQ. El topic viaja en cada mensaje; los .dlq los crea el script
// de topics de infra, así que no se autocrean.
func NewDeadLetterWriter(brokers []string) *segmentio.Writer {
	return &segmentio.Writer{
		Addr:                   segmentio.TCP(brokers...),
		RequiredAcks:           segmentio.RequireAll,
		WriteTimeout:           writeTimeout,
		AllowAutoTopicCreation: false,
	}
}
