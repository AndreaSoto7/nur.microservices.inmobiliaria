"""Clave de firma RS256 y su publicación como JWKS."""

import base64
import hashlib
import json
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

from cryptography.exceptions import UnsupportedAlgorithm
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from jwt.algorithms import RSAAlgorithm

ALGORITHM = "RS256"
MIN_RSA_KEY_BITS = 2048


class SigningKeyUnavailable(Exception):
    """No hay una clave de firma usable. El servicio no está listo (readiness DOWN)."""


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _public_numbers(key: RSAPrivateKey) -> dict:
    jwk = RSAAlgorithm.to_jwk(key.public_key(), as_dict=True)
    return {"n": jwk["n"], "e": jwk["e"]}


def _thumbprint(key: RSAPrivateKey) -> str:
    # kid = huella de la clave pública (RFC 7638): estable para la misma clave y distinta al
    # rotarla, así el gateway y los servicios saben cuándo volver a pedir el JWKS.
    numbers = _public_numbers(key)
    canonical = json.dumps(
        {"e": numbers["e"], "kty": "RSA", "n": numbers["n"]}, separators=(",", ":"), sort_keys=True
    )
    return _b64url(hashlib.sha256(canonical.encode()).digest())


@dataclass(frozen=True)
class SigningKey:
    private_key: RSAPrivateKey = field(repr=False)
    kid: str

    @classmethod
    def from_pem(cls, pem: bytes) -> "SigningKey":
        key = serialization.load_pem_private_key(pem, password=None)
        if not isinstance(key, RSAPrivateKey):
            raise ValueError("La clave de firma debe ser RSA (RS256).")
        if key.key_size < MIN_RSA_KEY_BITS:
            raise ValueError(f"La clave RSA debe tener al menos {MIN_RSA_KEY_BITS} bits.")
        return cls(private_key=key, kid=_thumbprint(key))

    def public_jwk(self) -> dict:
        """Solo la parte pública: nunca incluye d, p, q ni los demás parámetros privados."""
        return {"kty": "RSA", "use": "sig", "alg": ALGORITHM, "kid": self.kid} | _public_numbers(
            self.private_key
        )


def jwks(keys: Iterable[SigningKey]) -> dict:
    return {"keys": [key.public_jwk() for key in keys]}


def load_signing_key(*, pem: str, path: str) -> SigningKey:
    """Carga la clave desde su contenido PEM o, si no hay, desde un archivo.

    Cualquier problema (sin configurar, archivo ilegible, clave cifrada, no RSA, demasiado chica)
    sale como un único SigningKeyUnavailable, sin incluir el contenido de la clave.
    """
    try:
        if not pem and path:
            pem = Path(path).read_text()
        if not pem:
            raise SigningKeyUnavailable("Falta la clave de firma: define JWT_PRIVATE_KEY_PATH.")
        return SigningKey.from_pem(pem.encode())
    except (OSError, ValueError, TypeError, UnsupportedAlgorithm) as error:
        raise SigningKeyUnavailable(f"Clave de firma inválida: {type(error).__name__}") from error
