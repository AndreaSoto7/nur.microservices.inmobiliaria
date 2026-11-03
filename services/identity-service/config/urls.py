from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from identity.presentation import health

urlpatterns = [
    path("health", health.liveness, name="health"),
    path("health/ready", health.readiness, name="health-ready"),
    path("docs/schema", SpectacularAPIView.as_view(), name="schema"),
    path("docs", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/v1/", include("identity.presentation.urls")),
]

handler404 = "identity.presentation.errors.not_found"
handler500 = "identity.presentation.errors.server_error"
