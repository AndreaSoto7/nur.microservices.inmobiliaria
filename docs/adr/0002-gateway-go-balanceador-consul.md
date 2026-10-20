# 0002 — API Gateway propio en Go, con balanceador de carga y service discovery en Consul

- **Estado:** Propuesto
- **Fecha:** 2026-10-20
- **Autores:** @Tiesol

## Contexto

- El enunciado exige un **API Gateway** como único punto de entrada (criterio técnico 1).
- Además del PDF, el docente exige **balanceador de carga** y **service discovery** (ver "Requisitos adicionales del docente" en `docs/enunciado.md`).
- El ADR 0001 dejó pendiente la tecnología del gateway.
- Las reglas del repo ya le asignan al gateway: ruteo, validación temprana del JWT, CORS, rate limit y generación de `X-Correlation-Id`.
- Para mostrar el balanceo en la demo hace falta poder escalar un servicio a varias réplicas con `docker compose up --scale`. Hoy `CLAUDE.md` publica en el host el puerto de cada servicio (8001–8005), y eso impide escalar: dos réplicas no pueden publicar el mismo puerto.

## Opciones consideradas

### Gateway

1. **Gateway propio en Go** (`net/http` + `httputil.ReverseProxy` + middlewares).
   - Pros: el código es del equipo y se puede defender (Proxy, Chain of Responsibility, Strategy, Circuit Breaker). Usa el mismo stack que search y notification. Pocas dependencias. Control total sobre el balanceo y el discovery.
   - Contras: hay que escribir JWT/JWKS, CORS, rate limit, timeouts y el balanceador.
2. **Spring Cloud Gateway.**
   - Pros: maduro; se integra con Consul y Eureka por configuración.
   - Contras: suma un segundo servicio Java y una JVM más. Casi todo es configuración, así que hay poco que defender como diseño propio.
3. **KrakenD** (binario Go, configuración JSON).
   - Pros: JWT con JWKS, CORS y rate limit listos.
   - Contras: es declarativo, no hay código Go del equipo. El balanceo y el discovery dependen de su configuración (DNS SRV) y no de un diseño propio.
4. **nginx** (reverse proxy).
   - Pros: rápido y conocido.
   - Contras: validar un JWT RS256 con JWKS exige módulos extra (OpenResty/Lua). El discovery dinámico desde Consul necesita herramientas externas (consul-template).

### Service discovery

1. **Consul** (`hashicorp/consul`, modo dev).
   - Pros: es neutro al lenguaje (API HTTP), así que lo usan igual Django, Spring, NestJS y Go. Trae health checks propios y una UI en el puerto 8500 útil para la demo.
   - Contras: es un contenedor más.
2. **Eureka** (Spring Cloud Netflix).
   - Pros: muy usado con Spring.
   - Contras: está pensado para la JVM. Django, NestJS y Go necesitarían clientes de terceros poco mantenidos. No hace health checks activos: depende de heartbeats.
3. **DNS de Docker Compose** (resolver el nombre del servicio).
   - Pros: no suma nada.
   - Contras: no es un service registry: no hay health checks ni registro explícito, y no cumple el requisito del docente.

## Decisión

### Gateway

- **Gateway propio en Go** en `gateway/`, en el puerto 8080.
- Hace: ruteo por prefijo, validación temprana del JWT, CORS, rate limit, `X-Correlation-Id`, **balanceo de carga** y **cliente de service discovery**.

### Service discovery con Consul

- **Imagen y modo:** `hashicorp/consul` en modo dev, con UI en el puerto 8500.
- **Self-registration:** cada servicio se registra solo al arrancar, con un `PUT /v1/agent/service/register` a la API del agente de Consul.
  - Spring usa `spring-cloud-starter-consul-discovery` con `prefer-ip-address`.
  - Django, NestJS y Go hacen el `PUT` a mano.
- **Datos del registro:**
  - **Nombre:** el del servicio (`listing-service`).
  - **ID único por réplica:** `<servicio>-<hostname>`.
  - **Dirección:** la IP del contenedor, nunca `localhost`.
  - **Health check:** HTTP a `GET /health` cada 10 s.
- **Baja:** al apagarse, el servicio se da de baja. Además, el registro lleva `DeregisterCriticalServiceAfter`, para que Consul borre solas las réplicas que mueren sin avisar.
- **Consulta del gateway:** cada pocos segundos pide `GET /v1/health/service/<nombre>?passing=true` y guarda en memoria la lista de réplicas sanas de cada servicio.
- **Qué no se registra:** el gateway (nadie lo descubre: es el punto de entrada), Kafka y las bases de datos.

### Balanceador dentro del gateway

- **Round robin** entre las réplicas sanas que devuelve Consul.
- **Respaldo:** si una réplica falla (error de conexión o timeout), el gateway la marca como caída por un tiempo, aunque Consul todavía no lo haya detectado (Circuit Breaker por réplica).
- **Strategy:** el algoritmo va detrás de una interfaz, para poder cambiarlo (por ejemplo, por menor cantidad de conexiones) sin tocar el proxy.
- **Demo:** `listing-service` se escala a 3 réplicas.

### Autenticación (sin cambios respecto al repo)

- Cada servicio valida el JWT con el JWKS de identity.
- El gateway lo valida antes, como defensa temprana, y **reenvía `Authorization` intacto**.
- El gateway **borra cualquier `X-User-*`** que llegue del cliente.

### Puertos en Docker Compose

| Archivo | Qué publica en el host | Para qué |
|---|---|---|
| `infra/docker-compose.yml` (base) | Gateway 8080, frontend 5173, UI de Consul 8500 y UI de Kafka 8090 | Uso normal y demo. Los servicios y sus bases no publican puertos: se ven por la red interna y por Consul. Así funciona `--scale`. |
| `infra/docker-compose.debug.yml` (override) | Servicios 8001–8005, Postgres 5433–5437 y Kafka 9092 | Depurar un servicio desde el host. **No se combina con `--scale`.** |

- Ningún servicio usa `container_name`, porque impide escalar.
- Comando de la demo: `docker compose -f infra/docker-compose.yml up -d --scale listing-service=3`.

## Justificación

- **Gateway propio en Go:** cumple los tres requisitos (gateway, balanceador y discovery) con código del equipo que se puede explicar. Aplica los patrones del curso donde resuelven un problema real:
  - **Proxy:** el reverse proxy.
  - **Chain of Responsibility:** la cadena de middlewares.
  - **Strategy:** el algoritmo de balanceo.
  - **Circuit Breaker:** marcar como caída una réplica que falla.
  - **Service Registry / Self-Registration:** Consul.
- **Consul:** es el único de los evaluados que usan igual los cuatro stacks del proyecto, a través de su API HTTP.
- **Round robin:** es el algoritmo más simple que reparte la carga de forma visible en la demo (KISS). Que esté detrás de una Strategy deja abierta la puerta sin pagar complejidad ahora.

## Consecuencias

### Qué se gana

- Se cumplen el criterio 1 del enunciado y los dos requisitos adicionales del docente.
- El balanceo se puede mostrar: 3 réplicas de listing visibles en la UI de Consul, y cada request atendida por una distinta.

### Qué se pierde o qué riesgo se asume

- El gateway es un punto único de falla. Se acepta en un proyecto académico.
- **Consul en modo dev guarda todo en memoria.** Si se reinicia, los servicios deben volver a registrarse: se reinician o reintentan el registro.
- **Llamadas HTTP síncronas que este ADR autoriza** (regla de oro 2):
  - De los servicios y el gateway hacia la API de Consul.
  - Del gateway hacia los servicios.
  - De los servicios y el gateway hacia el JWKS de identity, que ya estaba implícito en el ADR 0001.
  - Entre servicios de negocio se sigue comunicando solo por Kafka.
- **Un servicio corriendo en el host** (fuera de Docker) no tiene una IP de contenedor. Para depurar así hace falta indicarle por variable de entorno la dirección con la que debe registrarse.

### Qué hay que hacer ahora

- `CLAUDE.md`: stack del gateway, puertos y Consul.
- Nueva rule `stack-gateway` y registro en Consul en cada rule de stack y en `/scaffold-servicio` (PR `chore(claude)` aparte).
- Registrar los patrones en `docs/patrones-de-diseno.md`.
- Crear `infra/docker-compose.yml` y `infra/docker-compose.debug.yml` con esta separación de puertos.
- Cada servicio agrega `CONSUL_HTTP_ADDR`, `SERVICE_NAME` y `SERVICE_PORT` a su `.env.example`.
