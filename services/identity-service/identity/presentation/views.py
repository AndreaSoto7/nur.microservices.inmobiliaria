from typing import ClassVar

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from identity import container
from identity.application.commands.register_user import RegisterUserCommand
from identity.presentation.serializers import (
    ProblemSerializer,
    RegisterUserRequestSerializer,
    RegisterUserResponseSerializer,
)

_PROBLEM = "application/problem+json"


class RegisterUserView(APIView):
    """POST /api/v1/auth/register (operationId registerUser). Público."""

    # El default del servicio es denegar: los endpoints públicos lo declaran explícitamente.
    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]

    @extend_schema(
        operation_id="registerUser",
        tags=["auth"],
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
