"""Emisión de JWT RS256 y JWKS con claves reales generadas en el test."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from identity.domain.email import Email
from identity.domain.errors import InvalidRefreshToken
from identity.domain.full_name import FullName
from identity.domain.refresh_token import RefreshToken
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
from identity.infrastructure.security.token_verifier import PyJwtRefreshTokenVerifier
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
        session_max=timedelta(days=30),
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


def test_access_token_carries_the_contract_claims(issuer, signing_key, user):
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


def test_access_header_carries_rs256_the_jwks_kid_and_typ_at_jwt(issuer, signing_key, user):
    header = jwt.get_unverified_header(issuer.issue(user).access_token)

    assert header["alg"] == ALGORITHM == "RS256"
    assert header["kid"] == jwks([signing_key])["keys"][0]["kid"]
    assert header["typ"] == "at+jwt"


def test_refresh_token_lasts_7_days_and_carries_no_personal_data(issuer, signing_key, user):
    refresh_token = issuer.issue(user).refresh_token
    claims = decode(refresh_token, signing_key, audience="identity-service")

    assert jwt.get_unverified_header(refresh_token)["typ"] == "rt+jwt"
    assert claims["aud"] == "identity-service"
    assert claims["tokenType"] == "refresh"
    assert claims["sub"] == str(user.id)
    assert claims["exp"] - claims["iat"] == 7 * 24 * 3600
    assert "email" not in claims


def test_refresh_token_is_not_accepted_as_access_token(issuer, signing_key, user):
    # Un servicio que valida aud=inmobiliaria (como pide el contrato) lo rechaza solo.
    with pytest.raises(jwt.InvalidAudienceError):
        decode(issuer.issue(user).refresh_token, signing_key)


def test_each_token_has_a_different_jti(issuer, signing_key, user):
    first, second = issuer.issue(user), issuer.issue(user)

    assert (
        decode(first.access_token, signing_key)["jti"]
        != decode(second.access_token, signing_key)["jti"]
    )


def test_jwks_only_publishes_the_public_part(signing_key):
    key = jwks([signing_key])["keys"][0]

    assert set(key) == {"kty", "use", "alg", "kid", "n", "e"}
    assert (key["kty"], key["use"], key["alg"]) == ("RSA", "sig", "RS256")


def test_kid_is_stable_for_the_same_key():
    pem = a_pem()

    assert SigningKey.from_pem(pem).kid == SigningKey.from_pem(pem).kid


def test_rejects_non_rsa_keys():
    from cryptography.hazmat.primitives.asymmetric import ec

    ec_pem = ec.generate_private_key(ec.SECP256R1()).private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )

    with pytest.raises(SigningKeyUnavailable):
        load_signing_key(pem=ec_pem.decode(), path="")


def test_loads_the_key_from_a_file(tmp_path):
    key_file = tmp_path / "jwt.pem"
    key_file.write_bytes(a_pem())

    assert load_signing_key(pem="", path=str(key_file)).kid


def test_without_configured_key_raises_signing_key_unavailable():
    with pytest.raises(SigningKeyUnavailable):
        load_signing_key(pem="", path="")


def test_missing_file_raises_signing_key_unavailable(tmp_path):
    with pytest.raises(SigningKeyUnavailable):
        load_signing_key(pem="", path=str(tmp_path / "no-existe.pem"))


def test_encrypted_key_raises_signing_key_unavailable():
    encrypted = rsa.generate_private_key(public_exponent=65537, key_size=2048).private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.BestAvailableEncryption(b"clave"),
    )

    with pytest.raises(SigningKeyUnavailable):
        load_signing_key(pem=encrypted.decode(), path="")


def test_rsa_key_under_2048_bits_raises_signing_key_unavailable():
    # Clave débil a propósito: se prueba que se rechace.
    small = rsa.generate_private_key(public_exponent=65537, key_size=1024).private_bytes(  # noqa: S505
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )

    with pytest.raises(SigningKeyUnavailable):
        load_signing_key(pem=small.decode(), path="")


@pytest.fixture
def verifier(signing_key) -> PyJwtRefreshTokenVerifier:
    return PyJwtRefreshTokenVerifier(signing_key=signing_key, issuer="identity-service")


def test_new_refresh_opens_a_family_and_keeps_it_on_rotation(issuer, verifier, user):
    first = verifier.verify(issuer.issue(user).refresh_token)
    other_login = verifier.verify(issuer.issue(user).refresh_token)
    rotated = verifier.verify(issuer.issue(user, renewing=first).refresh_token)

    assert other_login.family_id != first.family_id
    assert rotated.family_id == first.family_id
    assert rotated.jti != first.jti


def test_verifier_returns_the_token_data(issuer, verifier, user):
    first = verifier.verify(issuer.issue(user).refresh_token)

    token = verifier.verify(issuer.issue(user, renewing=first).refresh_token)

    assert token.user_id == user.id
    assert token.family_id == first.family_id
    assert token.session_started_at == NOW
    assert isinstance(token.jti, UUID)


def a_renewable_token(started_at: datetime, user: User) -> RefreshToken:
    return RefreshToken(
        jti=uuid4(),
        user_id=user.id,
        family_id=uuid4(),
        expires_at=NOW + timedelta(days=1),
        session_started_at=started_at,
    )


def test_login_starts_the_session_with_seven_days_of_life(issuer, verifier, user):
    token = verifier.verify(issuer.issue(user).refresh_token)

    assert token.session_started_at == NOW
    assert token.expires_at == NOW + timedelta(days=7)


def test_rotation_keeps_the_session_start_and_renews_seven_days(issuer, verifier, user):
    started_at = NOW - timedelta(days=10)

    token = verifier.verify(
        issuer.issue(user, renewing=a_renewable_token(started_at, user)).refresh_token
    )

    assert token.session_started_at == started_at
    assert token.expires_at == NOW + timedelta(days=7)


def test_rotation_near_the_cap_does_not_exceed_thirty_days_from_login(issuer, verifier, user):
    started_at = NOW - timedelta(days=28)

    token = verifier.verify(
        issuer.issue(user, renewing=a_renewable_token(started_at, user)).refresh_token
    )

    assert token.expires_at == started_at + timedelta(days=30)


def test_past_the_session_cap_the_refresh_is_born_expired(issuer, verifier, user):
    started_at = NOW - timedelta(days=31)

    refresh_token = issuer.issue(user, renewing=a_renewable_token(started_at, user)).refresh_token

    with pytest.raises(InvalidRefreshToken):
        verifier.verify(refresh_token)


def test_verifier_rejects_a_refresh_without_auth_time(signing_key, verifier, user):
    claims = {
        "sub": str(user.id),
        "iss": "identity-service",
        "aud": "identity-service",
        "iat": int(NOW.timestamp()),
        "exp": int((NOW + timedelta(days=7)).timestamp()),
        "jti": str(uuid4()),
        "fid": str(uuid4()),
    }
    token = jwt.encode(
        claims,
        signing_key.private_key,
        algorithm=ALGORITHM,
        headers={"kid": signing_key.kid, "typ": "rt+jwt"},
    )

    with pytest.raises(InvalidRefreshToken):
        verifier.verify(token)


def test_verifier_rejects_an_access_token(issuer, verifier, user):
    with pytest.raises(InvalidRefreshToken):
        verifier.verify(issuer.issue(user).access_token)


def test_verifier_rejects_an_expired_token(signing_key, verifier, user):
    past = NOW - timedelta(days=8)
    old_issuer = PyJwtTokenIssuer(
        signing_key=signing_key,
        issuer="identity-service",
        audience="inmobiliaria",
        access_ttl=timedelta(minutes=15),
        refresh_ttl=timedelta(days=7),
        session_max=timedelta(days=30),
        clock=FixedClock(past),
    )

    with pytest.raises(InvalidRefreshToken):
        verifier.verify(old_issuer.issue(user).refresh_token)


def test_verifier_rejects_a_token_signed_with_another_key(verifier, signing_key, user):
    other = PyJwtTokenIssuer(
        signing_key=SigningKey.from_pem(a_pem()),
        issuer="identity-service",
        audience="inmobiliaria",
        access_ttl=timedelta(minutes=15),
        refresh_ttl=timedelta(days=7),
        session_max=timedelta(days=30),
        clock=FixedClock(NOW),
    )

    with pytest.raises(InvalidRefreshToken):
        verifier.verify(other.issue(user).refresh_token)


@pytest.mark.parametrize("missing", ["jti", "sub", "fid", "exp"])
def test_verifier_requires_all_claims(signing_key, verifier, missing):
    claims = {
        "sub": str(uuid4()),
        "iss": "identity-service",
        "aud": "identity-service",
        "iat": int(NOW.timestamp()),
        "exp": int((NOW + timedelta(days=1)).timestamp()),
        "jti": str(uuid4()),
        "fid": str(uuid4()),
    }
    del claims[missing]
    token = jwt.encode(
        claims, signing_key.private_key, algorithm="RS256", headers={"typ": "rt+jwt"}
    )

    with pytest.raises(InvalidRefreshToken):
        verifier.verify(token)


def test_verifier_rejects_a_non_uuid_sub(signing_key, verifier):
    claims = {
        "sub": "no-uuid",
        "iss": "identity-service",
        "aud": "identity-service",
        "iat": int(NOW.timestamp()),
        "exp": int((NOW + timedelta(days=1)).timestamp()),
        "jti": str(uuid4()),
        "fid": str(uuid4()),
    }
    token = jwt.encode(
        claims, signing_key.private_key, algorithm="RS256", headers={"typ": "rt+jwt"}
    )

    with pytest.raises(InvalidRefreshToken):
        verifier.verify(token)
