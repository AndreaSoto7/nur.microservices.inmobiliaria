"""Rutas bajo /api/v1/ (contracts/openapi/identity-service.yaml)."""

from django.urls import path

from identity.presentation.views import RegisterUserView

urlpatterns = [
    path("auth/register", RegisterUserView.as_view(), name="auth-register"),
]
