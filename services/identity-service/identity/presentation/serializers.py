"""DTOs de request y response.

Criterio: el serializer valida el formato (campos obligatorios, tipos, email, largo del nombre) y
responde VALIDATION_ERROR. Las reglas de negocio (política de contraseña, roles permitidos) las
valida el dominio, con sus propios códigos (USER_WEAK_PASSWORD, USER_ROLE_NOT_ALLOWED).
"""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class StrictCharField(serializers.CharField):
    """CharField convierte números a texto. El contrato pide string: lo demás responde 400."""

    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


@extend_schema_field({"type": "string", "enum": ["CLIENT", "AGENT"], "default": "CLIENT"})
class SelfRegistrationRoleField(StrictCharField):
    """Se documenta como enum, pero la validación la hace el dominio (USER_ROLE_NOT_ALLOWED)."""


class RegisterUserRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    # Sin límites de largo: la política de 8 a 128 es del dominio y se valida antes de hashear.
    # El tamaño total del body ya lo acota Django (DATA_UPLOAD_MAX_MEMORY_SIZE).
    password = StrictCharField(write_only=True, trim_whitespace=False)
    full_name = StrictCharField(max_length=150)
    role = SelfRegistrationRoleField(required=False, max_length=20)


class RegisterUserResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()


class LoginRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = StrictCharField(write_only=True, trim_whitespace=False, max_length=1024)


@extend_schema_field({"type": "string", "const": "Bearer"})
class BearerField(serializers.CharField):
    pass


class TokenPairSerializer(serializers.Serializer):
    """Respuesta del login. Se serializa directamente desde el DTO TokenPair."""

    access_token = serializers.CharField()
    refresh_token = serializers.CharField()
    token_type = BearerField()
    expires_in = serializers.IntegerField()


class JwkSerializer(serializers.Serializer):
    kty = serializers.ChoiceField(choices=["RSA"])
    use = serializers.ChoiceField(choices=["sig"])
    alg = serializers.ChoiceField(choices=["RS256"])
    kid = serializers.CharField(help_text="Huella RFC 7638 de la clave pública (base64url).")
    n = serializers.CharField()
    e = serializers.CharField()


class JwksSerializer(serializers.Serializer):
    keys = JwkSerializer(many=True)


class ProblemSerializer(serializers.Serializer):
    """Solo para documentar las respuestas problem+json en /docs."""

    type = serializers.CharField()
    title = serializers.CharField()
    status = serializers.IntegerField()
    detail = serializers.CharField(required=False)
    instance = serializers.CharField(required=False)
    code = serializers.CharField()
    correlation_id = serializers.CharField()
    errors = serializers.ListField(child=serializers.DictField(), required=False)
