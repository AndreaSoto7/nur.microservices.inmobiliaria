"""Emisión de JWT RS256 y JWKS con claves reales generadas en el test."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from identity.domain.email import Email
from identity.domain.full_name import FullName
from identity.domain.role import Role
from identity.domain.user import User
from identity.infrastructure.security.keys import (
    ALGORITHM,
    SigningKey,
    SigningKeyUnavailable,
    jwks,
    load_signing_key,
)
from identity.infrastructure.security.token_issuer import PyJwtTokenIssuer
from tests.application.fakes import FixedClock

NOW = datetime.now(UTC).replace(microsecond=0)


def a_pem() -> bytes:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )


@pytest.fixture(scope="module")
def signing_key() -> SigningKey:
    return SigningKey.from_pem(a_pem())


@pytest.fixture
def issuer(signing_key) -> PyJwtTokenIssuer:
    return PyJwtTokenIssuer(
        signing_key=signing_key,
        issuer="identity-service",
        audience="inmobiliaria",
        access_ttl=timedelta(minutes=15),
        refresh_ttl=timedelta(days=7),
        clock=FixedClock(NOW),
    )


@pytest.fixture
def user() -> User:
    return User.register(
        email=Email("ana@example.com"),
        full_name=FullName("Ana Pérez"),
        password_hash="x",
        role=Role.AGENT,
        now=NOW,
    )


def decode(token: str, signing_key: SigningKey, audience: str = "inmobiliaria") -> dict:
    """Valida como lo harán el gateway y los servicios: firma, iss, aud y exp con el JWKS."""
    public_key = jwt.PyJWK(jwks([signing_key])["keys"][0]).key
    return jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        audience=audience,
        issuer="identity-service",
    )


def test_el_access_token_lleva_los_claims_del_contrato(issuer, signing_key, user):
    tokens = issuer.issue(user)

    claims = decode(tokens.access_token, signing_key)
    assert claims["sub"] == str(user.id)
    assert claims["email"] == "ana@example.com"
    assert claims["roles"] == ["AGENT"]
    assert claims["iss"] == "identity-service"
    assert claims["aud"] == "inmobiliaria"
    assert claims["tokenType"] == "access"
    assert claims["exp"] - claims["iat"] == 900
    assert tokens.expires_in == 900


def test_el_header_del_access_lleva_rs256_el_kid_del_jwks_y_typ_at_jwt(issuer, signing_key, user):
    header = jwt.get_unverified_header(issuer.issue(user).access_token)

    assert header["alg"] == ALGORITHM == "RS256"
    assert header["kid"] == jwks([signing_key])["keys"][0]["kid"]
    assert header["typ"] == "at+jwt"


def test_el_refresh_token_dura_7_dias_y_no_lleva_datos_personales(issuer, signing_key, user):
    refresh_token = issuer.issue(user).refresh_token
    claims = decode(refresh_token, signing_key, audience="identity-service")

    assert jwt.get_unverified_header(refresh_token)["typ"] == "rt+jwt"
    assert claims["aud"] == "identity-service"
    assert claims["tokenType"] == "refresh"
    assert claims["sub"] == str(user.id)
    assert claims["exp"] - claims["iat"] == 7 * 24 * 3600
    assert "email" not in claims


def test_el_refresh_token_no_sirve_como_access_token(issuer, signing_key, user):
    # Un servicio que valida aud=inmobiliaria (como pide el contrato) lo rechaza solo.
    with pytest.raises(jwt.InvalidAudienceError):
        decode(issuer.issue(user).refresh_token, signing_key)


def test_cada_token_tiene_un_jti_distinto(issuer, signing_key, user):
    first, second = issuer.issue(user), issuer.issue(user)

    assert (
        decode(first.access_token, signing_key)["jti"]
        != decode(second.access_token, signing_key)["jti"]
    )


def test_el_jwks_solo_publica_la_parte_publica(signing_key):
    key = jwks([signing_key])["keys"][0]

    assert set(key) == {"kty", "use", "alg", "kid", "n", "e"}
    assert (key["kty"], key["use"], key["alg"]) == ("RSA", "sig", "RS256")


def test_el_kid_es_estable_para_la_misma_clave():
    pem = a_pem()

    assert SigningKey.from_pem(pem).kid == SigningKey.from_pem(pem).kid


def test_rechaza_claves_que_no_son_rsa():
    from cryptography.hazmat.primitives.asymmetric import ec

    ec_pem = ec.generate_private_key(ec.SECP256R1()).private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )

    with pytest.raises(SigningKeyUnavailable):
        load_signing_key(pem=ec_pem.decode(), path="")


def test_carga_la_clave_desde_un_archivo(tmp_path):
    key_file = tmp_path / "jwt.pem"
    key_file.write_bytes(a_pem())

    assert load_signing_key(pem="", path=str(key_file)).kid


def test_sin_clave_configurada_lanza_signing_key_unavailable():
    with pytest.raises(SigningKeyUnavailable):
        load_signing_key(pem="", path="")


def test_un_archivo_inexistente_lanza_signing_key_unavailable(tmp_path):
    with pytest.raises(SigningKeyUnavailable):
        load_signing_key(pem="", path=str(tmp_path / "no-existe.pem"))


def test_una_clave_cifrada_lanza_signing_key_unavailable():
    encrypted = rsa.generate_private_key(public_exponent=65537, key_size=2048).private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.BestAvailableEncryption(b"clave"),
    )

    with pytest.raises(SigningKeyUnavailable):
        load_signing_key(pem=encrypted.decode(), path="")


def test_una_clave_rsa_de_menos_de_2048_bits_lanza_signing_key_unavailable():
    # Clave débil a propósito: se prueba que se rechace.
    small = rsa.generate_private_key(public_exponent=65537, key_size=1024).private_bytes(  # noqa: S505
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )

    with pytest.raises(SigningKeyUnavailable):
        load_signing_key(pem=small.decode(), path="")
