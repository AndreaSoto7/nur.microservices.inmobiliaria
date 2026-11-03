from django.db import connection


def check_database() -> None:
    """Consulta real: ensure_connection no comprueba nada si ya hay una conexión abierta."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
