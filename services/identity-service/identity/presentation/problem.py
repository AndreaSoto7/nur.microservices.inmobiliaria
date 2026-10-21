"""Cuerpos de error RFC 9457 (`application/problem+json`) con las extensiones del proyecto."""

from identity.infrastructure.observability import correlation_id

PROBLEM_CONTENT_TYPE = "application/problem+json"
PROBLEM_TYPE_BASE = "https://inmobiliaria.local/problems/"


def problem(
    *,
    status: int,
    code: str,
    title: str,
    detail: str | None = None,
    instance: str | None = None,
    errors: list[dict[str, str]] | None = None,
) -> dict:
    body = {
        "type": PROBLEM_TYPE_BASE + code.lower().replace("_", "-"),
        "title": title,
        "status": status,
        "code": code,
        "correlationId": correlation_id.get(),
    }
    if detail:
        body["detail"] = detail
    if instance:
        body["instance"] = instance
    if errors:
        body["errors"] = errors
    return body
