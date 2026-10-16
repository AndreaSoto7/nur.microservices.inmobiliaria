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
  - `NotificationFactory` que crea la notificación según el tipo de evento.
- **Builder:**
  - Criterios de búsqueda con muchos filtros opcionales en search-service (en Go, *functional options*).
  - Construcción de propiedades en tests (test data builders).
- **Singleton:** productor de Kafka, pool de conexiones a la base de datos. **Se implementa con el scope singleton del contenedor de DI** (Spring, Nest) o con una sola instancia creada en `main` (Go). No se usan singletons globales hechos a mano: dificultan los tests.

### Estructurales

- **Adapter:**
  - `ImageStorage` con `LocalImageStorage` o `MinioImageStorage` en listing.
  - `EventPublisher` implementado con Kafka.
  - Proveedor de email en notification.
  - Es la base de *puertos y adaptadores*.
- **Decorator:**
  - `CachedSearchRepository` que envuelve al repositorio real en search.
  - Decoradores de logging o métricas sobre handlers.
  - Interceptores de Nest.
  - En el front: ingredientes extra sin modificar la clase base, como en el ejercicio Burger Factory.
- **Facade:**
  - El API Gateway es una fachada sobre los microservicios.
  - En el frontend, un *facade service* oculta el store o los servicios HTTP a los componentes smart.

### De comportamiento

- **Observer / Pub-Sub:**
  - Eventos de dominio con sus handlers (`EventBus` de `@nestjs/cqrs`, `ApplicationEventPublisher` de Spring).
  - Kafka entre servicios.
  - Ejemplo: "notificar a la cocina" en el ejercicio = notificar al agente ante un `VisitRequested`.
- **Strategy:**
  - Canales de notificación (`EmailChannel`, `InAppChannel`, `LogChannel`).
  - Estrategias de ordenamiento o ranking del catálogo.
  - Cálculo de precio mostrado (venta vs. alquiler mensual).
- **Command:** cada comando de CQRS (`ScheduleVisitCommand`) es un objeto que encapsula la intención y lo ejecuta su handler a través del `CommandBus`.

### Arquitectónicos y de dominio (también cuentan y deben justificarse)

- **Repository:** un repositorio por aggregate.
- **State:** transiciones de `PropertyStatus` y `VisitStatus` encapsuladas, sin `switch` repartidos por todo el código.
- **Specification:** reglas combinables, como "se puede solicitar visita si la propiedad está PUBLISHED" o la composición de filtros de búsqueda.
- **Mediator:** `CommandBus` y `QueryBus` desacoplan controladores de handlers.
- **Outbox:** publicación confiable de eventos.
- **API Gateway** y **Database per Service:** patrones de microservicios.
- **Smart/Dumb Components:** frontend (ver la rule `frontend-smart-dumb`).

## Reglas

- Antes de aplicar un patrón, nombra el problema en una frase. Si no puedes, no lo apliques (KISS).
- Prefiere composición sobre herencia.
- Usa las herramientas idiomáticas del stack (DI de Spring o Nest, interfaces implícitas de Go) en vez de implementaciones de libro que peleen con el framework.
- Usa la skill `/aplicar-patron` para implementar y registrar un patrón en un solo paso.
