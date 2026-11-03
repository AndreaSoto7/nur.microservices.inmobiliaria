"""DTOs de request y response.

Criterio: el serializer valida el formato (campos obligatorios, tipos, email, largo del nombre) y
responde VALIDATION_ERROR. Las reglas de negocio (política de contraseña, roles permitidos) las
valida el dominio, con sus propios códigos (USER_WEAK_PASSWORD, USER_ROLE_NOT_ALLOWED).
"""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


@extend_schema_field({"type": "string", "enum": ["CLIENT", "AGENT"], "default": "CLIENT"})
class SelfRegistrationRoleField(serializers.CharField):
    """Se documenta como enum, pero la validación la hace el dominio (USER_ROLE_NOT_ALLOWED)."""


class RegisterUserRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    # Sin límites de largo: la política de 8 a 128 es del dominio y se valida antes de hashear.
    # El tamaño total del body ya lo acota Django (DATA_UPLOAD_MAX_MEMORY_SIZE).
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    full_name = serializers.CharField(max_length=150)
    role = SelfRegistrationRoleField(required=False, max_length=20)


class RegisterUserResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()


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
