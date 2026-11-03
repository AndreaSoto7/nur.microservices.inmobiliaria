"""Correlation-id de la operación en curso. Lo usan los logs, los errores y los eventos."""

from contextvars import ContextVar

correlation_id: ContextVar[str | None] = ContextVar("correlation_id", default=None)
