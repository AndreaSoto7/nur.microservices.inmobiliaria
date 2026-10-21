# Etapa 1: compila las dependencias a wheels (aquí quedan las herramientas de build).
FROM python:3.13-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# Etapa 2: imagen final, solo con los wheels instalados y el código. Corre sin root.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.base \
    SERVICE_PORT=8001
RUN useradd --create-home --uid 10001 app
WORKDIR /app
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index /wheels/* && rm -rf /wheels
COPY --chown=app:app . .
USER app
EXPOSE 8001

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=2)"

# `exec` hace que gunicorn sea el PID 1 y reciba el SIGTERM de `docker stop`; así corre `on_exit`
# y se da de baja en Consul.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn -c config/gunicorn.conf.py config.wsgi:application"]
