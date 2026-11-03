---
paths:
  - "services/**"
  - "gateway/**"
  - "infra/**"
---

# Service discovery con Consul

Decisión y alternativas: `docs/adr/0002-gateway-go-balanceador-consul.md`. Consul corre en modo dev (`hashicorp/consul`), con la UI en `http://localhost:8500`.

## Contrato común de registro (todos los servicios menos el gateway)

Cada servicio **se registra solo al arrancar** (self-registration) y **se da de baja al apagarse**.

### Variables de entorno

Van en el `.env.example` de cada servicio:

| Variable | Ejemplo | Nota |
|---|---|---|
| `CONSUL_HTTP_ADDR` | `http://consul:8500` | |
| `SERVICE_NAME` | `listing-service` | Es el nombre que usa el gateway para rutear. |
| `SERVICE_PORT` | `8002` | El puerto de la tabla de `CLAUDE.md`, dentro de la red de Docker. |
| `SERVICE_ADDRESS` | _(vacío)_ | Opcional. Si está vacío, se usa la IP del contenedor. Solo se llena para depurar un servicio que corre fuera de Docker. |

### Registro

Se hace **después de que el servidor HTTP ya escucha**, para que el primer health check pase: `PUT {CONSUL_HTTP_ADDR}/v1/agent/service/register` con este body.

```json
{
  "ID": "listing-service-<hostname>",
  "Name": "listing-service",
  "Address": "<IP del contenedor>",
  "Port": 8002,
  "Check": {
    "HTTP": "http://<IP del contenedor>:8002/health",
    "Interval": "10s",
    "Timeout": "2s",
    "DeregisterCriticalServiceAfter": "1m"
  }
}
```

- La API de Consul usa claves en **PascalCase**. Es una API externa, así que la convención camelCase del proyecto no aplica aquí.
- **ID único por réplica:** `<servicio>-<hostname>`. En Docker, el hostname es el ID corto del contenedor.
- **Dirección:** la IP del contenedor, que se obtiene resolviendo el propio hostname. **Nunca `localhost` ni `127.0.0.1`:** Consul y el gateway no podrían llegar.
- **`DeregisterCriticalServiceAfter`:** hace que Consul borre solas las réplicas que mueren sin darse de baja.
- **Si Consul todavía no está listo,** se reintenta con backoff. El servicio no se cae por eso.
- **Consul en modo dev guarda todo en memoria.** Si se reinicia, los servicios deben volver a registrarse. El `PUT` es idempotente, así que se puede repetir de forma periódica (por ejemplo, cada 60 s) sin efectos secundarios.

### Baja

Al recibir `SIGTERM`, el servicio llama a `PUT {CONSUL_HTTP_ADDR}/v1/agent/service/deregister/<ID>` y después cierra el servidor.

### Health

- **`GET /health`** (liveness) es el check de Consul. Responde 200 rápido y **no depende de la base ni de Kafka**: si la base parpadea, no conviene que Consul saque todas las réplicas a la vez.
- **`GET /health/ready`** (readiness) sí revisa sus dependencias. Lo usan Docker y la depuración.

## Qué no se registra

- **El gateway:** consume el catálogo de Consul, pero no se registra.
- **Kafka, las bases de datos, Kafka UI y el frontend:** se ubican por el nombre del servicio en Docker Compose.

## Docker Compose

- **`infra/docker-compose.yml`** publica en el host solo el gateway, el frontend, la UI de Consul y la UI de Kafka.
- **`infra/docker-compose.debug.yml`** publica además los puertos de los servicios, las bases y Kafka. No se combina con `--scale`.
- **Ningún servicio usa `container_name`.** Si lo tuviera, `--scale` fallaría.
- **Arranque:** los servicios declaran `depends_on` de Consul con `condition: service_healthy`, además de los reintentos de registro.
- **Demo de balanceo:** `docker compose -f infra/docker-compose.yml up -d --scale listing-service=3`.

La forma concreta de registrarse en cada stack está en su rule (`stack-*.md`).
