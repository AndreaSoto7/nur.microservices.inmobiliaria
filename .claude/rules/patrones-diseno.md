---
paths:
  - "services/**"
  - "gateway/**"
  - "frontend/**"
  - "docs/patrones-de-diseno.md"
---

# Patrones de diseño

Un patrón se usa porque resuelve un problema concreto del dominio, nunca "para que haya patrones". El enunciado exige patrones **aplicados y justificados**, así que **cada uso se registra en `docs/patrones-de-diseno.md`** con el patrón, el servicio, el archivo, el problema que resuelve y la alternativa descartada.

## Catálogo de la materia y dónde encaja en este proyecto

### Creacionales

- **Factory Method:**
  - `Property.create(...)` o una `PropertyFactory` que valida distinto para `HOUSE` y `APARTMENT`.
  - `User.register(...)` en identity (ya aplicado).
- **Builder:**
  - Criterios del catálogo público con muchos filtros opcionales en listing (`CatalogCriteria`).
  - Construcción de propiedades en tests (test data builders).
- **Singleton:** productor de Kafka, pool de conexiones a la base de datos. **Se implementa con el scope singleton del contenedor de DI** (Spring, Nest) o con una sola instancia creada en `main` (Go). No se usan singletons globales hechos a mano: dificultan los tests.

### Estructurales

- **Adapter:**
  - `ImageStorage` con `LocalImageStorage` o `MinioImageStorage` en listing.
  - `EventPublisher` implementado con Kafka.
  - `PasswordHasher` y `TokenIssuer` en identity (ya aplicados).
  - Es la base de *puertos y adaptadores*.
- **Decorator:**
  - Decoradores de logging o métricas sobre handlers.
  - Interceptores de Nest.
  - En el front: ingredientes extra sin modificar la clase base, como en el ejercicio Burger Factory.
- **Facade:**
  - El API Gateway es una fachada sobre los microservicios.
  - En el frontend, un custom hook por feature (`useCatalog`) oculta las llamadas HTTP y el estado a los componentes smart.
- **Proxy:**
  - El reverse proxy del gateway (`httputil.ReverseProxy`) se interpone entre el cliente y el servicio.
  - Controla el acceso (auth, rate limit) y elige la réplica, sin que el cliente sepa cuántas hay ni dónde están.

### De comportamiento

- **Observer / Pub-Sub:**
  - Eventos de dominio con sus handlers (`EventBus` de `@nestjs/cqrs`, `ApplicationEventPublisher` de Spring).
  - Kafka entre servicios: las **políticas** del ADR 0005 (visit reacciona a `PropertySold`; listing reacciona a `LeadClosed`). Es coreografía: nadie orquesta, cada servicio decide cómo reaccionar.
- **Strategy:**
  - Estrategias de ordenamiento del catálogo.
  - Cálculo de precio mostrado (venta vs. alquiler mensual).
  - Algoritmo de balanceo del gateway (`RoundRobin` hoy; otro algoritmo es otra implementación y no toca el proxy).
- **Command:** cada comando de CQRS (`ScheduleVisitCommand`) es un objeto que encapsula la intención y lo ejecuta su handler a través del `CommandBus`.
- **Chain of Responsibility:**
  - La cadena de middlewares del gateway: recover → correlation-id → logging → CORS → borrado de `X-User-*` → rate limit → auth → proxy.
  - Cada eslabón decide si corta la request (401, 429) o la pasa al siguiente.
  - En Go cada middleware además es un Decorator de `http.Handler`. Lo que la vuelve una cadena es que cualquier eslabón puede cortar.

### Arquitectónicos y de dominio (también cuentan y deben justificarse)

- **Repository:** un repositorio por aggregate.
- **State:** transiciones de `PropertyStatus`, `VisitStatus` y del `Lead` encapsuladas, sin `switch` repartidos por todo el código.
- **Specification:** reglas combinables, como "se puede solicitar visita si la propiedad está PUBLISHED" o la composición de filtros del catálogo.
- **Event-driven policy (coreografía):** un evento de un servicio dispara un comando en otro (ADR 0005). Sin ciclos y sin orquestador.
- **CQRS con proyección:** `property_catalog` en listing y la copia de propiedades en visit.
- **Mediator:** `CommandBus` y `QueryBus` desacoplan controladores de handlers.
- **Outbox:** publicación confiable de eventos.
- **API Gateway** y **Database per Service:** patrones de microservicios.
- **Service Registry + Self-Registration:**
  - Consul es el registro de servicios.
  - Cada servicio se registra solo al arrancar y se da de baja al apagarse.
  - El gateway descubre las réplicas sanas consultando el registro (rule `service-discovery`).
- **Circuit Breaker:**
  - El gateway marca como caída una réplica que falla y deja de enviarle tráfico por un tiempo.
  - Después la vuelve a probar (medio abierto).
  - Es un respaldo de los health checks de Consul.
- **Smart/Dumb Components:** frontend (ver `frontend/CLAUDE.md`).

## Reglas

- Antes de aplicar un patrón, nombra el problema en una frase. Si no puedes, no lo apliques (KISS).
- Prefiere composición sobre herencia.
- Usa las herramientas idiomáticas del stack (DI de Spring o Nest, interfaces implícitas de Go) en vez de implementaciones de libro que peleen con el framework.
- Usa la skill `/aplicar-patron` para implementar y registrar un patrón en un solo paso.
