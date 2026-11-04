#!/bin/sh
# Crea los topics del catálogo de eventos (contracts/events/README.md). Es idempotente.
set -e

KAFKA=/opt/kafka/bin/kafka-topics.sh
BOOTSTRAP=kafka:29092

create() {
  # $1: topic. $2 en adelante: configuración extra.
  topic="$1"
  shift
  "$KAFKA" --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
    --topic "$topic" --partitions 3 --replication-factor 1 "$@"
  "$KAFKA" --bootstrap-server "$BOOTSTRAP" --create --if-not-exists \
    --topic "$topic.dlq" --partitions 1 --replication-factor 1
}

# Sin vencimiento: search y visit se reconstruyen leyendo desde el principio.
create listing.property.events --config retention.ms=-1
# Retención por defecto: lleva datos personales, que no se guardan para siempre.
create identity.user.events
create visit.inquiry.events
create visit.visit.events

echo "Topics listos"
