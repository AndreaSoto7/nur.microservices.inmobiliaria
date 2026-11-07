import json
import logging

from identity.application.correlation import correlation_id
from identity.infrastructure.observability import CorrelationIdFilter, JsonFormatter


def a_record(**extra) -> logging.LogRecord:
    record = logging.LogRecord("identity.request", logging.INFO, __file__, 1, "request", (), None)
    record.__dict__.update(extra)
    CorrelationIdFilter().filter(record)
    return record


def test_log_is_json_with_the_correlation_id():
    token = correlation_id.set("corr-log")
    try:
        entry = json.loads(JsonFormatter().format(a_record(method="GET", status=200)))
    finally:
        correlation_id.reset(token)

    assert entry["correlationId"] == "corr-log"
    assert entry["method"] == "GET"
    assert entry["status"] == 200


def test_only_allowlisted_fields_are_emitted():
    entry = json.loads(JsonFormatter().format(a_record(password="S3gura-2026")))

    assert "password" not in entry


def test_health_is_not_logged(client, caplog):
    with caplog.at_level(logging.INFO, logger="identity.request"):
        client.get("/health")

    assert caplog.records == []
