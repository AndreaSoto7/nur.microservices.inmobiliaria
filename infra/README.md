# Infraestructura local

Docker Compose con Kafka (KRaft), Kafka UI, Consul y los servicios. Las decisiones están en el [ADR 0002](../docs/adr/0002-gateway-go-balanceador-consul.md).

## Levantar

```bash
bash infra/scripts/generate-env.sh      # una sola vez: crea infra/.env con secretos aleatorios
docker compose -f infra/docker-compose.yml up -d --build
```

| Qué | Dónde |
|---|---|
| Gateway (API) | http://localhost:8080 |
| Frontend | http://localhost:5173 |
| UI de Consul | http://127.0.0.1:8500 |
| UI de Kafka | http://127.0.0.1:8090 |

Para trabajar en un servicio, levanta solo lo que necesitas:

```bash
docker compose -f infra/docker-compose.yml up -d identity-service
```

El gateway y el frontend publican en todas las interfaces, así que el 8080 y el 5173 deben estar libres en tu máquina.

## Reglas de puertos (ADR 0002)

- **Uso normal y demo** (`docker-compose.yml`): solo se publican el gateway (8080) y el frontend (5173), más la UI de Consul (8500) y la de Kafka (8090) **solo en `127.0.0.1`**. Los servicios usan su puerto dentro de la red de Docker y se descubren por Consul; así se pueden escalar con `--scale`.
- **Depuración** (`docker-compose.debug.yml`): se publican además, solo en `127.0.0.1`, los servicios (identity 8001, listing 8002, visit 8003, audit 8004, notification 8005), sus PostgreSQL (desde 5433, uno por servicio, para no chocar con un Postgres local en 5432) y Kafka (9092).
- **Ningún servicio usa `container_name`**: impide escalar.
- **`visit-migrate` termina y queda en `Exited (0)`:** aplica las migraciones de visit una vez y sale. Es lo esperado, y `visit-service` lo espera antes de arrancar.

## Depurar desde el host

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.debug.yml up -d
```

Publica, **solo en `127.0.0.1`**: identity en 8001, su PostgreSQL en 5433 y Kafka en 9092. No se combina con `--scale`.

## Datos de ejemplo y demo de las cadenas de eventos

Con el stack levantado, `infra/scripts/demo.py` trabaja solo contra el gateway, como el frontend. Usa únicamente la biblioteca estándar de Python 3.10 o más nuevo.

```bash
python infra/scripts/demo.py seed     # carga datos para mostrar la UI
python infra/scripts/demo.py chains   # recorre las políticas del ADR 0005 en vivo
python infra/scripts/demo.py admin    # crea la cuenta de administrador
```

- **`admin`** crea a `admin@demo.test`, con la misma contraseña, para entrar al panel "Usuarios". El registro público nunca da ese rol, así que ejecuta `createsuperuser` dentro del contenedor de identity y necesita el CLI de docker. Si la cuenta ya existe, no hace nada.
- **`seed`** crea a la agente `agente@demo.test` y al interesado `cliente@demo.test`, con la contraseña `demo-inmobiliaria`, que se cambia con `DEMO_PASSWORD`.
  - Carga seis propiedades publicadas, con características y fotos. Las fotos son PNG generados por el script, así que no hay binarios en el repo.
  - Guarda dos favoritos, envía una consulta y deja una visita pendiente y otra programada.
  - Si la agente ya tiene propiedades, no vuelve a cargarlas.
- **`chains`** crea cuentas nuevas en cada corrida y muestra cuánto tarda cada reacción asíncrona:
  1. `PropertyPublished` llega a la copia local de visit, que recién entonces acepta solicitudes.
  2. `LeadClosed` (`WON`) hace que listing reserve la propiedad.
  3. `PropertyReserved` hace que visit rechace la solicitud pendiente y mantenga la programada.
  4. `PropertySold` hace que visit cancele la visita programada.
  5. Cada usuario recibe su bienvenida. La agente recibe las dos solicitudes y el aviso de reserva. Ana recibe los avisos de programación y cancelación de su visita, y Beto recibe el de rechazo de la suya. La demo comprueba el tipo de aviso en la cuenta del destinatario y compara la propiedad y la visita cuando corresponden.

  Si una reacción no llega en 45 s, el script termina con código 1 y dice cuál falló. Cada request lleva un `X-Correlation-Id` que empieza con `demo-`, para buscarlo en los logs. Los eventos se ven en la UI de Kafka.
- El gateway limita login y registro por minuto (`RATE_LIMIT_AUTH_PER_MINUTE`). Si responde 429, el script espera lo que indica `Retry-After` y reintenta.

### Balanceo, discovery y Circuit Breaker (ADR 0002)

```bash
docker compose -f infra/docker-compose.yml up -d --scale listing-service=3
python infra/scripts/demo.py balance              # réplicas en Consul y round robin del gateway
python infra/scripts/demo.py balance --failover   # además tumba una réplica y la recupera
```

- **`balance`** espera a que las réplicas estén sanas en Consul y manda tres requests por réplica a una ruta pública. Después muestra qué réplica atendió cada una. Lo lee del log JSON del gateway (campo `upstream`), buscando por `X-Correlation-Id`, así que necesita el CLI de docker.
- **`--failover`** mata una réplica con `docker kill`, sin que se dé de baja, y vuelve a mandar requests:
  - La primera request que le toca responde 504 (o 502), y el gateway saca la réplica.
  - El resto va a las réplicas sanas, aunque Consul todavía la vea sana: su health check corre cada 10 s.
  - Después la arranca de nuevo y espera a que Consul la vea sana y a que el gateway le vuelva a mandar tráfico. Eso pasa cuando termina `REPLICA_DOWN_DURATION` (30 s).
- `--service identity-service` hace lo mismo con identity, con `--scale identity-service=2`. Para terminar, vuelve a una réplica con `--scale listing-service=1`.

## Agregar tu servicio

En tu propio PR:
1. Agrega tu servicio y su base a `docker-compose.yml`, sin `container_name` y sin publicar puertos.
2. Agrega sus puertos de depuración a `docker-compose.debug.yml`, con `127.0.0.1`.
3. Agrega sus secretos a `scripts/generate-env.sh` y a `.env.example`.
4. Pon `DJANGO_DEBUG=false` o el equivalente de tu stack en `environment:`.

## Apagar

```bash
docker compose -f infra/docker-compose.yml down        # conserva los datos
docker compose -f infra/docker-compose.yml down -v     # borra también los datos
```
