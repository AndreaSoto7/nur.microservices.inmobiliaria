#!/usr/bin/env python3
"""Datos de ejemplo y demostración de las cadenas de eventos (ADR 0005), todo a través del gateway.

    python infra/scripts/demo.py seed     # agente, interesado, propiedades con fotos, favoritos y visitas
    python infra/scripts/demo.py chains   # recorre las políticas entre listing y visit y muestra cada reacción

Solo usa la biblioteca estándar (Python 3.10 o más nuevo). Necesita el stack levantado
(`docker compose -f infra/docker-compose.yml up -d --build`). Las cuentas de `seed` son de la demo local:
la contraseña se cambia con la variable `DEMO_PASSWORD`.
"""

import argparse
import json
import os
import struct
import sys
import time
import urllib.error
import urllib.request
import uuid
import zlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

DEFAULT_GATEWAY = "http://localhost:8080"
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "demo-inmobiliaria")
AGENT_EMAIL = "agente@demo.test"
CLIENT_EMAIL = "cliente@demo.test"
MAX_RATE_LIMIT_RETRIES = 6
POLL_INTERVAL_SECONDS = 0.5
EVENT_TIMEOUT_SECONDS = 45


class DemoError(Exception):
    """Un paso de la demo no dio lo esperado: se muestra el mensaje y el script termina con código 1."""


@dataclass
class Response:
    status: int
    body: dict | None


class Gateway:
    """Cliente HTTP mínimo del gateway: JSON, token, Idempotency-Key y reintento ante el rate limit."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def call(self, method: str, path: str, body=None, token=None, idempotent=False, raw=None) -> Response:
        headers = {"X-Correlation-Id": f"demo-{uuid.uuid4().hex[:12]}"}
        data = None
        if body is not None:
            data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
        if raw is not None:
            data, headers["Content-Type"] = raw
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if idempotent:
            headers["Idempotency-Key"] = str(uuid.uuid4())
        request = urllib.request.Request(self.base_url + path, data=data, method=method, headers=headers)
        for _ in range(MAX_RATE_LIMIT_RETRIES):
            status, retry_after, payload = self._send(request)
            if status != 429:
                return Response(status, json.loads(payload) if payload else None)
            print(f"   … el gateway limita login y registro: espero {retry_after} s")
            time.sleep(retry_after)
        raise DemoError("El gateway sigue respondiendo 429: sube RATE_LIMIT_AUTH_PER_MINUTE para la demo")

    @staticmethod
    def _send(request: urllib.request.Request) -> tuple[int, int, bytes]:
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.status, 0, response.read()
        except urllib.error.HTTPError as error:
            return error.code, int(error.headers.get("Retry-After") or 10), error.read()
        except urllib.error.URLError as error:
            raise DemoError(
                f"No responde el gateway en {request.full_url}: ¿está levantado el stack? ({error})"
            ) from None


def expect(response: Response, *statuses: int, what: str) -> dict:
    if response.status not in statuses:
        detail = (response.body or {}).get("detail") or (response.body or {}).get("code") or ""
        raise DemoError(f"{what}: respondió {response.status} {detail}".strip())
    return response.body or {}


def wait_until(what: str, check, timeout: float = EVENT_TIMEOUT_SECONDS):
    """Espera una reacción asíncrona (consistencia eventual) y muestra cuánto tardó."""
    started = time.monotonic()
    while time.monotonic() - started < timeout:
        value = check()
        if value:
            print(f"   ✔ {what} ({time.monotonic() - started:.1f} s)")
            return value
        time.sleep(POLL_INTERVAL_SECONDS)
    raise DemoError(f"{what}: no pasó en {timeout:.0f} s. Revisa los logs del servicio y la UI de Kafka")


def utc_in(days: int, hour: int) -> str:
    moment = (datetime.now(UTC) + timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


# --- Fotos: PNG válidos generados aquí, sin archivos binarios en el repo ---


def house_png(wall: tuple[int, int, int], width: int = 640, height: int = 420) -> bytes:
    """Una casa simple: cielo en degradé, pasto, paredes del color pedido, techo, puerta y ventana."""
    rows = []
    for y in range(height):
        row = bytearray(b"\x00")
        for x in range(width):
            row += bytes(_pixel(x, y, width, height, wall))
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", header) + _chunk(b"IDAT", raw) + _chunk(b"IEND", b"")


def _pixel(x: int, y: int, width: int, height: int, wall: tuple[int, int, int]) -> tuple[int, int, int]:
    left, right, top, ground = width * 0.28, width * 0.72, height * 0.45, height * 0.78
    roof_peak = height * 0.22
    if left <= x <= right and top <= y <= ground:
        in_door = width * 0.46 <= x <= width * 0.54 and y >= height * 0.6
        in_window = width * 0.33 <= x <= width * 0.41 and height * 0.52 <= y <= height * 0.62
        return (90, 60, 40) if in_door else (170, 210, 235) if in_window else wall
    half = (right - left) / 2 + width * 0.03
    if roof_peak <= y < top and abs(x - width / 2) <= half * (y - roof_peak) / (top - roof_peak):
        return (150, 55, 45)
    if y > ground:
        return (70, 140, 70)
    shade = y / ground
    return (int(120 + 80 * shade), int(180 + 50 * shade), 245)


def _chunk(kind: bytes, data: bytes) -> bytes:
    checksum = zlib.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


def multipart_images(colors: list[tuple[int, int, int]]) -> tuple[bytes, str]:
    boundary = f"----demo{uuid.uuid4().hex}"
    parts = b""
    for index, color in enumerate(colors):
        parts += (
            (
                f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="foto-{index}.png"\r\n'
                "Content-Type: image/png\r\n\r\n"
            ).encode()
            + house_png(color)
            + b"\r\n"
        )
    return parts + f"--{boundary}--\r\n".encode(), f"multipart/form-data; boundary={boundary}"


# --- Pasos de negocio, cada uno contra la API pública del gateway ---


@dataclass
class User:
    id: str
    email: str
    token: str


@dataclass
class Sample:
    title: str
    property_type: str
    operation: str
    amount: int
    zone: str
    bedrooms: int
    bathrooms: int
    area_m2: float
    features: list[str]
    colors: list[tuple[int, int, int]]


SAMPLES = [
    Sample(
        "Casa con jardín en Equipetrol",
        "HOUSE",
        "SALE",
        1285000,
        "Equipetrol",
        3,
        2,
        240.5,
        ["GARAGE", "GARDEN", "PET_FRIENDLY"],
        [(235, 225, 200), (210, 190, 160)],
    ),
    Sample(
        "Departamento amoblado cerca del centro",
        "APARTMENT",
        "RENT",
        3500,
        "Centro",
        1,
        1,
        55,
        ["FURNISHED", "ELEVATOR", "AIR_CONDITIONING"],
        [(200, 205, 215)],
    ),
    Sample(
        "Casa con piscina en el Urubó",
        "HOUSE",
        "SALE",
        2450000,
        "Urubó",
        4,
        3,
        420,
        ["POOL", "GARAGE", "SECURITY", "GARDEN"],
        [(245, 240, 230), (225, 200, 170), (190, 210, 200)],
    ),
    Sample(
        "Departamento con balcón en Las Palmas",
        "APARTMENT",
        "SALE",
        690000,
        "Las Palmas",
        2,
        2,
        98,
        ["BALCONY", "ELEVATOR", "COMMON_AREAS"],
        [(215, 195, 175), (230, 230, 220)],
    ),
    Sample(
        "Casa familiar en alquiler en el Norte",
        "HOUSE",
        "RENT",
        6200,
        "Norte",
        3,
        2,
        180,
        ["GARAGE", "GARDEN", "SECURITY"],
        [(240, 215, 180)],
    ),
    Sample(
        "Monoambiente para estudiantes cerca de la UAGRM",
        "APARTMENT",
        "RENT",
        1800,
        "Centro",
        1,
        1,
        32,
        ["FURNISHED", "PET_FRIENDLY"],
        [(205, 220, 230)],
    ),
]


def sign_in(gw: Gateway, email: str, password: str, full_name: str, role: str) -> User:
    """Registra la cuenta si no existe (409 = ya estaba) y entra."""
    registration = {"email": email, "password": password, "fullName": full_name, "role": role}
    expect(gw.call("POST", "/api/v1/auth/register", registration), 201, 409, what=f"Registrar {email}")
    login = expect(
        gw.call("POST", "/api/v1/auth/login", {"email": email, "password": password}),
        200,
        what=f"Entrar con {email} (si cambiaste la contraseña, usa DEMO_PASSWORD)",
    )
    me = expect(gw.call("GET", "/api/v1/users/me", token=login["accessToken"]), 200, what="Leer /users/me")
    return User(me["id"], email, login["accessToken"])


def publish_property(gw: Gateway, agent: User, sample: Sample) -> str:
    created = expect(
        gw.call(
            "POST",
            "/api/v1/properties",
            {
                "title": sample.title,
                "description": f"{sample.title}. Bien iluminada, lista para mudarse y cerca de comercios.",
                "propertyType": sample.property_type,
                "operationType": sample.operation,
                "price": {"amount": sample.amount, "currency": "BOB"},
                "location": {"zone": sample.zone, "address": "Calle de ejemplo #123"},
            },
            token=agent.token,
        ),
        201,
        what=f"Crear «{sample.title}»",
    )
    path = f"/api/v1/properties/{created['id']}"
    features = {
        "bedrooms": sample.bedrooms,
        "bathrooms": sample.bathrooms,
        "areaM2": sample.area_m2,
        "features": sample.features,
    }
    expect(gw.call("PUT", f"{path}/features", features, token=agent.token), 204, what="Cargar características")
    images = multipart_images(sample.colors)
    expect(gw.call("POST", f"{path}/images", token=agent.token, raw=images), 201, what="Subir fotos")
    expect(gw.call("POST", f"{path}/publish", token=agent.token), 204, what=f"Publicar «{sample.title}»")
    return created["id"]


def request_visit(gw: Gateway, client: User, property_id: str, proposed_at: str, what: str) -> str:
    """visit acepta la solicitud recién cuando su copia local recibió `PropertyPublished`.

    Mientras tanto responde 404 PROPERTY_NOT_FOUND, que no guarda la clave de idempotencia: se reintenta.
    """
    body = {"propertyId": property_id, "proposedAt": proposed_at, "clientNote": "Prefiero por la tarde."}

    def attempt():
        response = gw.call("POST", "/api/v1/visits", body, token=client.token, idempotent=True)
        if response.status == 404 and (response.body or {}).get("code") == "PROPERTY_NOT_FOUND":
            return None
        return expect(response, 201, what="Solicitar visita")["id"]

    return wait_until(what, attempt)


def visit_status(gw: Gateway, user: User, visit_id: str) -> dict:
    return expect(gw.call("GET", f"/api/v1/visits/{visit_id}", token=user.token), 200, what="Leer visita")


def schedule_visit(gw: Gateway, agent: User, visit_id: str, start: str) -> None:
    expect(
        gw.call(
            "POST", f"/api/v1/visits/{visit_id}/schedule", {"scheduledStart": start}, token=agent.token, idempotent=True
        ),
        200,
        what="Programar visita",
    )


def send_inquiry(gw: Gateway, client: User, property_id: str, message: str) -> None:
    inquiry = {
        "propertyId": property_id,
        "contactName": "Cliente Demo",
        "contactEmail": client.email,
        "message": message,
    }
    expect(
        gw.call("POST", "/api/v1/inquiries", inquiry, token=client.token, idempotent=True), 201, what="Enviar consulta"
    )


def lead_of(gw: Gateway, agent: User, property_id: str, client: User) -> str | None:
    page = expect(
        gw.call("GET", f"/api/v1/leads?propertyId={property_id}", token=agent.token), 200, what="Listar oportunidades"
    )
    return next((lead["id"] for lead in page["data"] if lead["clientId"] == client.id), None)


def catalog_status(gw: Gateway, property_id: str) -> str | None:
    response = gw.call("GET", f"/api/v1/catalog/properties/{property_id}")
    return (response.body or {}).get("status") if response.status == 200 else None


def notifications(gw: Gateway, user: User) -> list[dict]:
    page = expect(gw.call("GET", "/api/v1/notifications?size=10", token=user.token), 200, what="Leer avisos")
    return page["data"]


# --- Comandos ---


def seed(gw: Gateway) -> None:
    print("1. Cuentas de la demo")
    agent = sign_in(gw, AGENT_EMAIL, DEMO_PASSWORD, "Carla Agente", "AGENT")
    client = sign_in(gw, CLIENT_EMAIL, DEMO_PASSWORD, "Diego Interesado", "CLIENT")
    mine = expect(gw.call("GET", "/api/v1/properties?size=1", token=agent.token), 200, what="Mis propiedades")
    if mine["page"]["totalElements"] > 0:
        print("   La agente ya tiene propiedades: no se cargan de nuevo.")
        print_accounts()
        return
    print("2. Propiedades publicadas, con características y fotos")
    ids = []
    for sample in SAMPLES:
        ids.append(publish_property(gw, agent, sample))
        print(f"   ✔ {sample.title}")
    print("3. Lo que hace el interesado")
    for property_id in ids[:2]:
        expect(
            gw.call("POST", "/api/v1/favorites", {"propertyId": property_id}, token=client.token),
            201,
            what="Guardar favorito",
        )
    print("   ✔ 2 favoritos")
    send_inquiry(gw, client, ids[1], "¿Se aceptan mascotas? ¿Cuánto es la garantía?")
    print("   ✔ 1 consulta (abre una oportunidad)")
    request_visit(gw, client, ids[0], utc_in(days=3, hour=21), "1 visita pendiente")
    scheduled = request_visit(gw, client, ids[2], utc_in(days=4, hour=14), "1 visita más…")
    schedule_visit(gw, agent, scheduled, utc_in(days=4, hour=15))
    print("   ✔ … programada por la agente")
    print_accounts()


def print_accounts() -> None:
    print(
        f"\nListo. Entra en http://localhost:5173 con {AGENT_EMAIL} o {CLIENT_EMAIL} "
        f"(contraseña: la de DEMO_PASSWORD, por defecto «{DEMO_PASSWORD}»)."
    )


def chains(gw: Gateway) -> None:
    """Cuentas nuevas en cada corrida: así se puede repetir sin choques de horarios ni solicitudes."""
    run = uuid.uuid4().hex[:6]
    password = f"demo-{uuid.uuid4().hex}"
    print("Preparación: una agente y dos interesados nuevos")
    agent = sign_in(gw, f"agente-{run}@demo.test", password, "Agente Cadenas", "AGENT")
    ana = sign_in(gw, f"ana-{run}@demo.test", password, "Ana Interesada", "CLIENT")
    beto = sign_in(gw, f"beto-{run}@demo.test", password, "Beto Interesado", "CLIENT")

    print("\nCadena 1 · listing → visit: PropertyPublished alimenta la copia local de visit")
    sample = Sample(
        f"Casa de la demo {run}", "HOUSE", "SALE", 990000, "Equipetrol", 3, 2, 200, ["GARAGE"], [(230, 220, 200)]
    )
    property_id = publish_property(gw, agent, sample)
    print(f"   ✔ listing publicó «{sample.title}»")
    ana_visit = request_visit(
        gw,
        ana,
        property_id,
        utc_in(days=5, hour=14),
        "visit recibió PropertyPublished: ya acepta la solicitud de visita de Ana",
    )
    schedule_visit(gw, agent, ana_visit, utc_in(days=5, hour=14))
    print("   ✔ la agente programó la visita de Ana")
    beto_visit = request_visit(
        gw, beto, property_id, utc_in(days=6, hour=18), "la solicitud de Beto queda pendiente (REQUESTED)"
    )

    print("\nCadena 2 · visit → listing: LeadClosed (WON) reserva la propiedad")
    lead_id = wait_until("visit abrió la oportunidad de Ana", lambda: lead_of(gw, agent, property_id, ana))
    close = {"outcome": "WON", "note": "Ana confirmó que quiere comprar."}
    expect(
        gw.call("POST", f"/api/v1/leads/{lead_id}/close", close, token=agent.token, idempotent=True),
        200,
        what="Cerrar oportunidad",
    )
    print("   ✔ la agente cerró la oportunidad de Ana como ganada")
    wait_until(
        "listing reservó la propiedad (RESERVED en el catálogo)", lambda: catalog_status(gw, property_id) == "RESERVED"
    )

    print("\nCadena 3 · listing → visit: PropertyReserved rechaza las solicitudes pendientes")
    rejected = wait_until(
        "visit rechazó la solicitud de Beto", lambda: _with_status(visit_status(gw, beto, beto_visit), "REJECTED")
    )
    print(f"     motivo: {rejected.get('resolutionReason')}")
    print(f"   ✔ la visita programada de Ana sigue {visit_status(gw, ana, ana_visit)['status']}")

    print("\nCadena 4 · listing → visit: PropertySold cancela las visitas programadas")
    expect(
        gw.call("POST", f"/api/v1/properties/{property_id}/mark-sold", token=agent.token), 204, what="Marcar vendida"
    )
    print("   ✔ la agente marcó la propiedad como vendida")
    cancelled = wait_until(
        "visit canceló la visita programada de Ana", lambda: _with_status(visit_status(gw, ana, ana_visit), "CANCELLED")
    )
    print(f"     motivo: {cancelled.get('resolutionReason')}")

    print("\nAvisos · identity, listing y visit → notification")
    for user in (agent, ana, beto):
        received = wait_until(f"avisos de {user.email}", lambda u=user: notifications(gw, u))
        for item in received:
            print(f"     [{item['type']}] {item['message']}")
    print("\nTodas las cadenas respondieron. Los eventos se ven en la UI de Kafka: http://127.0.0.1:8090")


def _with_status(visit: dict, status: str) -> dict | None:
    return visit if visit["status"] == status else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["seed", "chains"])
    parser.add_argument("--gateway", default=DEFAULT_GATEWAY, help=f"URL del gateway (por defecto {DEFAULT_GATEWAY})")
    args = parser.parse_args()
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    try:
        (seed if args.command == "seed" else chains)(Gateway(args.gateway))
    except DemoError as error:
        print(f"   ✘ {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
