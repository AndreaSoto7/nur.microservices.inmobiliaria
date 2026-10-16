---
paths:
  - "services/**"
---

# DDD, arquitectura limpia y CQRS

Cada microservicio es un **bounded context** con su propio modelo, su propia base de datos y su propio lenguaje.

## Capas y regla de dependencia

```
presentation (API)  ─┐
                     ├──► application ──► domain
infrastructure      ─┘
```

| Capa | Contiene | Prohibido |
|---|---|---|
| `domain` | Entidades, aggregates, value objects, eventos de dominio, interfaces de repositorio (puertos), servicios de dominio, errores de dominio | Importar frameworks, ORM, HTTP, Kafka o logging de infraestructura |
| `application` | Comandos, consultas, handlers (casos de uso), DTOs de aplicación, puertos de salida (`EventPublisher`, `ImageStorage`, `Clock`) | Lógica de negocio que pertenece al aggregate; SQL; detalles de HTTP |
| `infrastructure` | Repositorios (ORM), entidades de persistencia, mappers, productor/consumidor Kafka, outbox, adaptadores externos | Reglas de negocio |
| `presentation` | Controladores/views, DTOs de request y response, validación de formato, mapeo de errores a HTTP | Acceder directo a la base de datos o al ORM |

**Las entidades de persistencia (JPA `@Entity`, modelos de Django, entidades de TypeORM) no son el modelo de dominio.** Viven en `infrastructure` y se mapean hacia y desde el dominio.

## Bloques de construcción

- **Value Object:** inmutable, se valida en el constructor y se compara por valor. Ejemplos: `Money`, `Location`, `Area`, `Email`, `PropertyId`.
- **Entity:** tiene identidad (UUID) y ciclo de vida.
- **Aggregate:** un grupo de entidades con una raíz que protege las invariantes.
  - Se modifica **un aggregate por transacción**.
  - Otros aggregates se referencian **por ID**, no por objeto.
- **Repository:** uno por aggregate. La interfaz va en `domain` y la implementación en `infrastructure`. Guarda y recupera aggregates completos.
- **Domain Event:** algo que pasó en el dominio, en pasado (`PropertyPublished`). Lo registra el aggregate y se despacha después de guardar.
- **Factory:** crea aggregates válidos cuando la construcción es compleja (`Property.create(...)`).
- **Domain Service:** reglas que no encajan en un solo aggregate.

**Prohibido el modelo anémico.** La regla vive en el aggregate:

```
property.publish()        ✅  valida el estado y registra PropertyPublished
property.setStatus(...)   ❌  cualquiera cambia el estado sin reglas
```

## Máquinas de estado del dominio

**Property** (listing-service):

| Desde | Acción | Hacia | Evento |
|---|---|---|---|
| `DRAFT` | `publish()` | `PUBLISHED` | `PropertyPublished` |
| `PUBLISHED` | `pause()` | `PAUSED` | `PropertyPaused` |
| `PAUSED` | `publish()` | `PUBLISHED` | `PropertyPublished` |
| `PUBLISHED` | `reserve()` | `RESERVED` | `PropertyReserved` |
| `RESERVED` | `releaseReservation()` | `PUBLISHED` | `PropertyPublished` |
| `PUBLISHED` / `RESERVED` | `markSold()` (solo `SALE`) | `SOLD` | `PropertySold` |
| `PUBLISHED` / `RESERVED` | `markRented()` (solo `RENT`) | `RENTED` | `PropertyRented` |

**Visit** (visit-service): `REQUESTED → SCHEDULED → COMPLETED`. Desde `REQUESTED` también se puede pasar a `REJECTED`, y desde `REQUESTED` o `SCHEDULED` a `CANCELLED`.

- Solo se puede solicitar una visita a una propiedad `PUBLISHED`. visit-service lo sabe por los eventos de listing que guarda localmente.

Cualquier otra transición lanza un error de dominio, que la API traduce a **409 Conflict**.

## CQRS

- **Comando:** `PublishPropertyCommand` → `PublishPropertyHandler`.
  - El handler carga el aggregate, invoca el método de dominio, guarda y registra los eventos en el outbox.
  - Devuelve como máximo el ID creado.
- **Consulta:** `GetPropertyByIdQuery` → `GetPropertyByIdHandler`.
  - Puede saltarse el dominio y leer proyecciones o DTOs directamente. Nunca modifica estado.
- **Nombres:**
  - Comandos en imperativo: `ScheduleVisitCommand`.
  - Consultas: `Get…Query` o `List…Query`.
  - Eventos en pasado: `VisitScheduled`.
- **Modelo de lectura del catálogo:** search-service se alimenta de los eventos de listing. Es un caso de CQRS entre servicios.

## Eventos de dominio vs. eventos de integración

- Los **eventos de dominio** son internos del servicio.
- Los **eventos de integración** son los contratos publicados en Kafka (`contracts/events/`).
- Un mapper en `infrastructure` traduce unos a otros. Así se puede cambiar el modelo interno sin romper a los consumidores.
- Al consumir eventos de otro servicio, se traducen a tu propio modelo (**anti-corruption layer**). Nunca importes código ni modelos de otro servicio.

## Ubicación por stack

| Concepto | Django (identity) | Spring (listing) | NestJS (visit) | Go (search, notification) |
|---|---|---|---|---|
| Dominio | `identity/domain/` | `…listing.domain` | `src/<modulo>/domain/` | `internal/domain/` |
| Aplicación | `identity/application/` | `…listing.application` | `src/<modulo>/application/` | `internal/application/` |
| Infraestructura | `identity/infrastructure/` | `…listing.infrastructure` | `src/<modulo>/infrastructure/` | `internal/infrastructure/` |
| Presentación | `identity/presentation/` | `…listing.presentation` | `src/<modulo>/presentation/` | `internal/interfaces/http/` |
