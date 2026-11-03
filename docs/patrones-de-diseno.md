# Registro de patrones de diseño

El enunciado exige patrones **aplicados y justificados**. Cada vez que se implementa uno, se agrega aquí una fila (la skill `/aplicar-patron` lo hace sola). Esta tabla es la base para la defensa del proyecto.

## Aplicados

| Patrón | Categoría | Servicio | Archivo(s) | Problema que resuelve | Por qué este y no otro |
|---|---|---|---|---|---|
| Factory Method | Creacional | identity | `identity/domain/user.py` (`User.register`) | Crear un usuario válido exige generar el UUID, rechazar `ADMIN` y registrar `UserRegistered`; un constructor libre permitiría saltarse esas reglas | Un Builder no aporta: los campos son pocos y todos obligatorios |
| Repository | DDD | identity | `identity/domain/repository.py`, `identity/infrastructure/persistence/repositories.py` | El dominio no debe conocer el ORM de Django | Usar `UserModel` directo en el handler acoplaría el caso de uso a Django y exigiría una base en cada test |
| Adapter | Estructural | identity | `identity/infrastructure/security/password_hasher.py` | Adaptar los hashers de Django al puerto `PasswordHasher` de la capa de aplicación | Llamar a `make_password` desde el handler metería a Django en `application` |
| Command | Comportamiento | identity | `identity/application/commands/register_user.py` | Encapsular la intención de registrar un usuario, separada de HTTP (CQRS) | Sin `CommandBus` (Mediator): con pocos casos de uso, el handler se invoca directo desde la vista (KISS) |

## Planificados (candidatos, mover a "Aplicados" al implementarlos)

| Patrón | Categoría | Servicio | Idea |
|---|---|---|---|
| API Gateway | Microservicios | gateway | Único punto de entrada: auth, CORS, rate limit, ruteo, balanceo de carga (ADR 0002) |
| Service Registry + Self-Registration | Microservicios | todos + gateway | Cada servicio se registra solo en Consul; el gateway descubre las réplicas sanas |
| Circuit Breaker | Resiliencia | gateway | Marcar como caída una réplica que falla, como respaldo de los health checks de Consul |
| Proxy | Estructural | gateway | Reverse proxy entre el cliente y las réplicas: controla el acceso y oculta su ubicación |
| Chain of Responsibility | Comportamiento | gateway | Cadena de middlewares (correlation-id, CORS, rate limit, auth); cualquier eslabón puede cortar |
| Strategy | Comportamiento | gateway | Algoritmo de balanceo intercambiable (round robin) |
| Mediator | Comportamiento | visit, listing | `CommandBus` / `QueryBus` desacoplan los controladores de los handlers |
| Database per Service | Microservicios | todos | Persistencia independiente |
| CQRS | Arquitectura | listing + search | Comandos en listing, lectura optimizada en search |
| Outbox | Integración | identity, listing, visit | Publicación confiable de eventos |
| Repository | DDD | todos | Un repositorio por aggregate; el dominio no conoce el ORM |
| Factory Method | Creacional | listing | `Property.create()` valida distinto según `HOUSE` o `APARTMENT` |
| Builder | Creacional | search | Criterios de búsqueda con muchos filtros opcionales |
| Singleton | Creacional | todos | Productor de Kafka y pool de BD con scope singleton del contenedor de DI |
| Adapter | Estructural | listing | `ImageStorage` → almacenamiento local o MinIO |
| Decorator | Estructural | search | Repositorio con caché que envuelve al real |
| Facade | Estructural | frontend | Custom hook por feature (`useCatalog`) que oculta la API y el estado a los componentes smart |
| Observer / Pub-Sub | Comportamiento | todos | Eventos de dominio y Kafka |
| Strategy | Comportamiento | notification | Canales de notificación intercambiables |
| Command | Comportamiento | visit, listing | Comandos CQRS ejecutados por `CommandBus` |
| State | Comportamiento | listing, visit | Transiciones de `PropertyStatus` y `VisitStatus` |
| Specification | DDD | visit, search | "Se puede solicitar visita si está PUBLISHED"; filtros combinables |
| Smart/Dumb Components | Frontend | frontend | Separar lógica de presentación |
