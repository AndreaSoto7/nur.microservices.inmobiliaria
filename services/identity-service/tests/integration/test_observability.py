import json
import logging

from identity.application.correlation import correlation_id
from identity.infrastructure.observability import CorrelationIdFilter, JsonFormatter


def a_record(**extra) -> logging.LogRecord:
    record = logging.LogRecord("identity.request", logging.INFO, __file__, 1, "request", (), None)
    record.__dict__.update(extra)
    CorrelationIdFilter().filter(record)
    return record


def test_el_log_es_json_con_el_correlation_id():
    token = correlation_id.set("corr-log")
    try:
        entry = json.loads(JsonFormatter().format(a_record(method="GET", status=200)))
    finally:
        correlation_id.reset(token)

    assert entry["correlationId"] == "corr-log"
    assert entry["method"] == "GET"
    assert entry["status"] == 200


def test_solo_salen_los_campos_de_la_lista_blanca():
    entry = json.loads(JsonFormatter().format(a_record(password="S3gura-2026")))

    assert "password" not in entry


def test_health_no_se_loguea(client, caplog):
    with caplog.at_level(logging.INFO, logger="identity.request"):
        client.get("/health")

    assert caplog.records == []
