from typing import ClassVar

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from identity import container
from identity.application.commands.refresh_tokens import RefreshTokensCommand
from identity.application.commands.register_user import RegisterUserCommand
from identity.application.queries.authenticate_user import AuthenticateUserQuery
from identity.application.queries.get_current_user import GetCurrentUserQuery
from identity.presentation.authentication import BearerAuthentication
from identity.presentation.serializers import (
    CurrentUserSerializer,
    JwksSerializer,
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
            AuthenticateUserQuery(
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
