from typing import ClassVar
from uuid import UUID

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from identity import container
from identity.application.commands.administer_users import (
    ActivateUserCommand,
    AssignUserRolesCommand,
    DeactivateUserCommand,
)
from identity.application.commands.authenticate_user import AuthenticateUserCommand
from identity.application.commands.logout import LogoutCommand
from identity.application.commands.refresh_tokens import RefreshTokensCommand
from identity.application.commands.register_user import RegisterUserCommand
from identity.application.queries.get_current_user import GetCurrentUserQuery
from identity.application.queries.list_users import ListUsersQuery
from identity.domain.role import Role
from identity.presentation.authentication import BearerAuthentication
from identity.presentation.serializers import (
    AdminUserPageSerializer,
    AssignUserRolesRequestSerializer,
    CurrentUserSerializer,
    JwksSerializer,
    ListUsersParamsSerializer,
    LoginRequestSerializer,
    ProblemSerializer,
    RefreshTokensRequestSerializer,
    RegisterUserRequestSerializer,
    RegisterUserResponseSerializer,
    TokenPairSerializer,
)

_PROBLEM = "application/problem+json"
# Las respuestas con tokens no se guardan en cachés (RFC 6749, sección 5.1).
_NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}
# El JWKS sí se puede cachear un rato: cambia solo al rotar la clave (el kid avisa).
JWKS_MAX_AGE_SECONDS = 300


def _response_header(name: str, description: str) -> OpenApiParameter:
    return OpenApiParameter(
        name, str, location=OpenApiParameter.HEADER, response=[200], description=description
    )


class RegisterUserView(APIView):
    """POST /api/v1/auth/register. Público."""

    # El default del servicio es denegar: los endpoints públicos lo declaran explícitamente.
    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]

    @extend_schema(
        operation_id="registerUser",
        tags=["auth"],
        summary="Registrar un usuario",
        request=RegisterUserRequestSerializer,
        responses={
            201: RegisterUserResponseSerializer,
            (400, _PROBLEM): OpenApiResponse(
                ProblemSerializer,
                description="VALIDATION_ERROR, USER_WEAK_PASSWORD o USER_ROLE_NOT_ALLOWED",
            ),
            (409, _PROBLEM): OpenApiResponse(
                ProblemSerializer, description="USER_EMAIL_ALREADY_REGISTERED"
            ),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = RegisterUserRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user_id = container.register_user_handler().handle(
            RegisterUserCommand(
                email=data["email"],
                password=data["password"],
                full_name=data["full_name"],
                role=data.get("role"),
            )
        )
        return Response({"id": str(user_id)}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """POST /api/v1/auth/login. Público; el gateway le aplica rate limit."""

    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]

    @extend_schema(
        operation_id="login",
        tags=["auth"],
        summary="Iniciar sesión",
        request=LoginRequestSerializer,
        parameters=[
            _response_header("Cache-Control", "no-store"),
            _response_header("Pragma", "no-cache"),
        ],
        responses={
            200: TokenPairSerializer,
            (400, _PROBLEM): OpenApiResponse(ProblemSerializer, description="VALIDATION_ERROR"),
            (401, _PROBLEM): OpenApiResponse(
                ProblemSerializer, description="AUTH_INVALID_CREDENTIALS"
            ),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = LoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tokens = container.authenticate_user_handler().handle(
            AuthenticateUserCommand(
                email=serializer.validated_data["email"],
                password=serializer.validated_data["password"],
            )
        )
        return Response(TokenPairSerializer(tokens).data, headers=_NO_STORE)


class RefreshTokensView(APIView):
    """POST /api/v1/auth/refresh. Público: la credencial es el propio refresh token."""

    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]

    @extend_schema(
        operation_id="refreshTokens",
        tags=["auth"],
        summary="Renovar los tokens",
        request=RefreshTokensRequestSerializer,
        parameters=[
            _response_header("Cache-Control", "no-store"),
            _response_header("Pragma", "no-cache"),
        ],
        responses={
            200: TokenPairSerializer,
            (400, _PROBLEM): OpenApiResponse(ProblemSerializer, description="VALIDATION_ERROR"),
            (401, _PROBLEM): OpenApiResponse(
                ProblemSerializer, description="AUTH_INVALID_REFRESH_TOKEN"
            ),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = RefreshTokensRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tokens = container.refresh_tokens_handler().handle(
            RefreshTokensCommand(refresh_token=serializer.validated_data["refresh_token"])
        )
        return Response(TokenPairSerializer(tokens).data, headers=_NO_STORE)


class LogoutView(APIView):
    """POST /api/v1/auth/logout. Público: la credencial es el propio refresh token."""

    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]

    @extend_schema(
        operation_id="logout",
        tags=["auth"],
        summary="Cerrar sesión",
        request=RefreshTokensRequestSerializer,
        responses={
            204: None,
            (400, _PROBLEM): OpenApiResponse(ProblemSerializer, description="VALIDATION_ERROR"),
            (401, _PROBLEM): OpenApiResponse(
                ProblemSerializer, description="AUTH_INVALID_REFRESH_TOKEN"
            ),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = RefreshTokensRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        container.logout_handler().handle(
            LogoutCommand(refresh_token=serializer.validated_data["refresh_token"])
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CurrentUserView(APIView):
    """GET /api/v1/users/me. Requiere access token."""

    authentication_classes: ClassVar[list] = [BearerAuthentication]
    permission_classes: ClassVar[list] = [IsAuthenticated]

    @extend_schema(
        operation_id="getCurrentUser",
        tags=["users"],
        summary="Datos del usuario autenticado",
        responses={
            200: CurrentUserSerializer,
            (401, _PROBLEM): OpenApiResponse(ProblemSerializer, description="AUTH_INVALID_TOKEN"),
        },
    )
    def get(self, request: Request) -> Response:
        profile = container.get_current_user_handler().handle(
            GetCurrentUserQuery(user_id=request.user.id)
        )
        return Response(CurrentUserSerializer(profile).data)


class _AdminView(APIView):
    """Exige un access token válido. El rol ADMIN lo comprueba cada caso de uso, en la base."""

    authentication_classes: ClassVar[list] = [BearerAuthentication]
    permission_classes: ClassVar[list] = [IsAuthenticated]


_ADMIN_ERRORS = {
    (401, _PROBLEM): OpenApiResponse(ProblemSerializer, description="AUTH_INVALID_TOKEN"),
    (403, _PROBLEM): OpenApiResponse(ProblemSerializer, description="USER_ADMIN_REQUIRED"),
}
_USER_CHANGE_ERRORS = {
    **_ADMIN_ERRORS,
    (404, _PROBLEM): OpenApiResponse(ProblemSerializer, description="USER_NOT_FOUND"),
    (409, _PROBLEM): OpenApiResponse(ProblemSerializer, description="USER_OWN_ACCOUNT_PROTECTED"),
}


class UsersView(_AdminView):
    """GET /api/v1/users. Solo ADMIN."""

    @extend_schema(
        operation_id="listUsers",
        tags=["users"],
        summary="Listar los usuarios",
        parameters=[ListUsersParamsSerializer],
        responses={
            200: AdminUserPageSerializer,
            (400, _PROBLEM): OpenApiResponse(ProblemSerializer, description="VALIDATION_ERROR"),
            **_ADMIN_ERRORS,
        },
    )
    def get(self, request: Request) -> Response:
        params = ListUsersParamsSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        role = params.validated_data.get("role")
        result = container.list_users_handler().handle(
            ListUsersQuery(
                actor_id=request.user.id,
                page=params.validated_data["page"],
                size=params.validated_data["size"],
                role=Role(role) if role else None,
            )
        )
        return Response(
            AdminUserPageSerializer(
                {
                    "data": result.data,
                    "page": {
                        "number": result.number,
                        "size": result.size,
                        "total_elements": result.total_elements,
                        "total_pages": result.total_pages,
                    },
                }
            ).data
        )


class UserRolesView(_AdminView):
    """PUT /api/v1/users/{userId}/roles. Solo ADMIN."""

    @extend_schema(
        operation_id="assignUserRoles",
        tags=["users"],
        summary="Reemplazar los roles de un usuario",
        request=AssignUserRolesRequestSerializer,
        responses={
            204: None,
            (400, _PROBLEM): OpenApiResponse(ProblemSerializer, description="VALIDATION_ERROR"),
            **_USER_CHANGE_ERRORS,
        },
    )
    def put(self, request: Request, user_id: UUID) -> Response:
        serializer = AssignUserRolesRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        container.assign_user_roles_handler().handle(
            AssignUserRolesCommand(
                actor_id=request.user.id,
                user_id=user_id,
                roles=tuple(serializer.validated_data["roles"]),
            )
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeactivateUserView(_AdminView):
    """POST /api/v1/users/{userId}/deactivate. Solo ADMIN."""

    @extend_schema(
        operation_id="deactivateUser",
        tags=["users"],
        summary="Desactivar una cuenta",
        request=None,
        responses={204: None, **_USER_CHANGE_ERRORS},
    )
    def post(self, request: Request, user_id: UUID) -> Response:
        container.deactivate_user_handler().handle(
            DeactivateUserCommand(actor_id=request.user.id, user_id=user_id)
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActivateUserView(_AdminView):
    """POST /api/v1/users/{userId}/activate. Solo ADMIN."""

    @extend_schema(
        operation_id="activateUser",
        tags=["users"],
        summary="Volver a activar una cuenta",
        request=None,
        responses={
            204: None,
            **_ADMIN_ERRORS,
            (404, _PROBLEM): OpenApiResponse(ProblemSerializer, description="USER_NOT_FOUND"),
        },
    )
    def post(self, request: Request, user_id: UUID) -> Response:
        container.activate_user_handler().handle(
            ActivateUserCommand(actor_id=request.user.id, user_id=user_id)
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class JwksView(APIView):
    """GET /api/v1/auth/.well-known/jwks.json. Público: lo consumen el gateway y los servicios."""

    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]

    @extend_schema(
        operation_id="getJwks",
        tags=["auth"],
        summary="Claves públicas para validar los JWT",
        responses={200: JwksSerializer},
        parameters=[_response_header("Cache-Control", f"public, max-age={JWKS_MAX_AGE_SECONDS}")],
    )
    def get(self, request: Request) -> Response:
        return Response(
            container.public_jwks(),
            headers={"Cache-Control": f"public, max-age={JWKS_MAX_AGE_SECONDS}"},
        )
