"""Outbox: el evento se guarda en la misma transacción que el usuario y un relay lo publica."""

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import jsonschema
import pytest
from confluent_kafka import KafkaException
from django.db import DatabaseError, IntegrityError

from identity.application.correlation import correlation_id
from identity.domain.email import Email
from identity.domain.errors import EmailAlreadyRegistered
from identity.domain.events import UserRegistered
from identity.domain.full_name import FullName
from identity.domain.role import Role
from identity.domain.user import User
from identity.infrastructure.messaging.integration_events import USER_TOPIC, to_integration_event
from identity.infrastructure.messaging.relay import publish_pending
from identity.infrastructure.persistence import repositories
from identity.infrastructure.persistence.management.commands import run_outbox_relay
from identity.infrastructure.persistence.mappers import to_model
from identity.infrastructure.persistence.models import OutboxMessage, UserModel
from identity.infrastructure.persistence.repositories import DjangoUserRepository

EVENTS = Path(__file__).resolve().parents[4] / "contracts/events"
NOW = datetime(2026, 11, 3, 14, 30, tzinfo=UTC)


def a_user() -> User:
    return User.register(
        email=Email("ana@example.com"),
        full_name=FullName("Ana Pérez"),
        password_hash="hash-secreto",
        role=Role.AGENT,
        now=NOW,
    )


def an_event() -> UserRegistered:
    return UserRegistered(
        user_id=uuid4(),
        email="ana@example.com",
        full_name="Ana Pérez",
        roles=("AGENT",),
        occurred_at=NOW,
    )


class FakeProducer:
    def __init__(self, fail_keys: set[str] | None = None) -> None:
        self.sent: list[tuple[str, str, dict]] = []
        self.fail_keys = fail_keys or set()

    def publish(self, messages: list[OutboxMessage]) -> set:
        delivered = set()
        for message in messages:
            if message.aggregate_id in self.fail_keys:
                continue
            self.sent.append((message.topic, message.aggregate_id, message.envelope))
            delivered.add(message.id)
        return delivered


def test_el_evento_cumple_el_contrato():
    token = correlation_id.set("corr-1")
    try:
        integration = to_integration_event(an_event())
    finally:
        correlation_id.reset(token)

    envelope = json.loads((EVENTS / "envelope.schema.json").read_text())
    payload = json.loads((EVENTS / "identity/user-registered.v1.schema.json").read_text())
    jsonschema.validate(integration.envelope, envelope)
    jsonschema.validate(integration.envelope["payload"], payload)
    assert integration.topic == USER_TOPIC == "identity.user.events"
    assert integration.envelope["eventType"] == "UserRegistered"
    assert integration.envelope["producer"] == "identity-service"
    assert integration.envelope["correlationId"] == "corr-1"
    assert integration.envelope["occurredAt"] == "2026-11-03T14:30:00Z"
    assert integration.key == integration.envelope["aggregateId"]


def test_sin_request_en_curso_genera_un_correlation_id_valido():
    envelope = to_integration_event(an_event()).envelope

    jsonschema.validate(envelope, json.loads((EVENTS / "envelope.schema.json").read_text()))


def test_el_evento_no_lleva_la_contrasena():
    assert "hash" not in json.dumps(to_integration_event(an_event()).envelope)


@pytest.mark.django_db
def test_guardar_un_usuario_escribe_su_evento_en_el_outbox():
    user = a_user()

    DjangoUserRepository().add(user)

    message = OutboxMessage.objects.get()
    assert message.aggregate_id == str(user.id)
    assert message.topic == "identity.user.events"
    assert message.envelope["payload"]["email"] == "ana@example.com"
    assert message.published_at is None
    assert user.pull_events() == []


@pytest.mark.django_db
def test_si_falla_el_outbox_tampoco_se_guarda_el_usuario(monkeypatch):
    def broken(event):
        raise RuntimeError("fallo al armar el evento")

    monkeypatch.setattr(repositories, "to_integration_event", broken)

    with pytest.raises(RuntimeError):
        DjangoUserRepository().add(a_user())

    assert not UserModel.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_si_falla_el_usuario_tampoco_se_guarda_el_evento(monkeypatch):
    def broken(user):
        model = to_model(user)
        model.full_name = None  # NOT NULL
        return model

    monkeypatch.setattr(repositories, "to_model", broken)

    with pytest.raises(IntegrityError):
        DjangoUserRepository().add(a_user())

    assert not OutboxMessage.objects.exists()


@pytest.mark.django_db
def test_el_relay_publica_con_la_clave_del_agregado_y_marca_lo_enviado():
    user = a_user()
    DjangoUserRepository().add(user)
    producer = FakeProducer()

    published = publish_pending(producer, now=NOW)

    assert published == 1
    topic, key, envelope = producer.sent[0]
    assert (topic, key) == ("identity.user.events", str(user.id))
    assert envelope["eventType"] == "UserRegistered"
    assert OutboxMessage.objects.get().published_at == NOW


@pytest.mark.django_db
def test_el_relay_no_vuelve_a_publicar_lo_enviado():
    DjangoUserRepository().add(a_user())
    producer = FakeProducer()
    publish_pending(producer, now=NOW)

    assert publish_pending(producer, now=NOW) == 0
    assert len(producer.sent) == 1


@pytest.mark.django_db
def test_lo_que_kafka_no_confirma_queda_pendiente_para_reintentar():
    user = a_user()
    DjangoUserRepository().add(user)

    assert publish_pending(FakeProducer(fail_keys={str(user.id)}), now=NOW) == 0
    assert OutboxMessage.objects.get().published_at is None

    producer = FakeProducer()
    assert publish_pending(producer, now=NOW) == 1
    assert len(producer.sent) == 1


@pytest.mark.django_db
def test_el_endpoint_de_registro_deja_el_evento_en_el_outbox(client):
    response = client.post(
        "/api/v1/auth/register",
        {"email": "ana@example.com", "password": "S3gura-2026", "fullName": "Ana"},
        content_type="application/json",
        headers={"X-Correlation-Id": "corr-registro"},
    )

    message = OutboxMessage.objects.get()
    assert message.aggregate_id == response.json()["id"]
    assert message.envelope["correlationId"] == "corr-registro"


@pytest.mark.django_db
def test_un_email_repetido_no_deja_un_evento_huerfano():
    repository = DjangoUserRepository()
    repository.add(a_user())

    with pytest.raises(EmailAlreadyRegistered):
        repository.add(a_user())

    assert OutboxMessage.objects.count() == 1


@pytest.mark.django_db
def test_el_comando_publica_lo_pendiente(monkeypatch):
    from django.core.management import call_command

    from identity import container

    producer = FakeProducer()
    monkeypatch.setattr(container, "event_producer", lambda: producer)
    DjangoUserRepository().add(a_user())

    call_command("run_outbox_relay", "--once")

    assert len(producer.sent) == 1
    assert OutboxMessage.objects.get().published_at is not None


def test_el_productor_solo_informa_lo_que_kafka_confirmo(monkeypatch):
    from identity.infrastructure.messaging import kafka_producer

    class FakeKafka:
        def __init__(self, config, logger=None):
            self.config = config
            self.logger = logger
            self.callbacks = []

        def produce(self, topic, key, value, on_delivery):
            self.callbacks.append((key, on_delivery))

        def flush(self, timeout):
            for key, callback in self.callbacks:
                callback("fallo" if key == b"falla" else None, None)

    monkeypatch.setattr(kafka_producer, "Producer", FakeKafka)
    producer = kafka_producer.KafkaEventProducer("kafka:29092")
    ok = OutboxMessage(id=uuid4(), topic="t", aggregate_id="bien", envelope={})
    bad = OutboxMessage(id=uuid4(), topic="t", aggregate_id="falla", envelope={})

    assert producer.publish([ok, bad]) == {ok.id}
    assert producer._producer.config["acks"] == "all"
    assert producer._producer.config["enable.idempotence"] is True
    assert producer._producer.logger is not None


@pytest.mark.parametrize("error", [DatabaseError("sin base"), KafkaException("sin kafka")])
def test_un_error_de_base_o_de_kafka_no_tumba_el_relay(monkeypatch, error):
    def broken(producer, *, now):
        raise error

    monkeypatch.setattr(run_outbox_relay, "publish_pending", broken)
    monkeypatch.setattr(run_outbox_relay, "close_old_connections", lambda: None)

    assert run_outbox_relay.publish_once(FakeProducer()) == 0


def test_un_bug_de_programacion_si_tumba_el_relay(monkeypatch):
    def broken(producer, *, now):
        raise TypeError("bug")

    monkeypatch.setattr(run_outbox_relay, "publish_pending", broken)
    monkeypatch.setattr(run_outbox_relay, "close_old_connections", lambda: None)

    with pytest.raises(TypeError):
        run_outbox_relay.publish_once(FakeProducer())
