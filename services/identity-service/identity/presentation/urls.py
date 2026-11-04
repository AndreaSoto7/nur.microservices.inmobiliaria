"""Rutas bajo /api/v1/ (contracts/openapi/identity-service.yaml)."""

from django.urls import path

from identity.presentation.views import (
    CurrentUserView,
    JwksView,
    LoginView,
    RefreshTokensView,
    RegisterUserView,
)

urlpatterns = [
    path("auth/register", RegisterUserView.as_view(), name="auth-register"),
    path("auth/login", LoginView.as_view(), name="auth-login"),
    path("auth/refresh", RefreshTokensView.as_view(), name="auth-refresh"),
    path("users/me", CurrentUserView.as_view(), name="users-me"),
    path("auth/.well-known/jwks.json", JwksView.as_view(), name="auth-jwks"),
]
