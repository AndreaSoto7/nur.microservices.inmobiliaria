from django.apps import AppConfig


class PersistenceConfig(AppConfig):
    # El modelo de Django es solo persistencia, así que la app vive en infrastructure.
    # El label corto "identity" da AUTH_USER_MODEL = "identity.UserModel".
    name = "identity.infrastructure.persistence"
    label = "identity"
    verbose_name = "Identity"
    default_auto_field = "django.db.models.BigAutoField"
