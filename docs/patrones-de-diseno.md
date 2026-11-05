# Registro de patrones de diseño

El enunciado exige patrones **aplicados y justificados**. Cada vez que se implementa uno, se agrega aquí una fila (la skill `/aplicar-patron` lo hace sola). Esta tabla es la base para la defensa del proyecto.

## Aplicados

| Patrón | Categoría | Servicio | Archivo(s) | Problema que resuelve | Por qué este y no otro |
|---|---|---|---|---|---|
| Factory Method | Creacional | identity | `identity/domain/user.py` (`User.register`) | Crear un usuario válido exige generar el UUID, rechazar `ADMIN` y registrar `UserRegistered`; un constructor libre permitiría saltarse esas reglas | Un Builder no aporta: los campos son pocos y todos obligatorios |
| Smart/Dumb Components | Frontend | frontend | `frontend/src/features/auth/containers/*Page.tsx` (smart), `features/auth/components/*Form.tsx` (dumb) | Que un formulario no mezcle la llamada a la API, la sesión y la navegación con el render; así el form se prueba y reutiliza solo | Un componente por pantalla con todo adentro es el "componente Dios" que pide evitar `frontend/CLAUDE.md` |
| Facade | Estructural | frontend | `frontend/src/features/auth/useAuthActions.ts` (`useLogin`, `useRegister`) | Las páginas necesitan "ingresar" o "registrarse" con su estado (enviando, error), sin conocer `authApi`, React Query ni el manejo de tokens | Llamar a `authApi` desde la página acopla la UI a la API y repite el manejo de errores en cada pantalla |
| Repository | DDD | identity | `identity/domain/repository.py`, `identity/infrastructure/persistence/repositories.py` | El dominio no debe conocer el ORM de Django | Usar `UserModel` directo en el handler acoplaría el caso de uso a Django y exigiría una base en cada test |
| Adapter | Estructural | identity | `identity/infrastructure/security/password_hasher.py` | Adaptar los hashers de Django al puerto `PasswordHasher` de la capa de aplicación | Llamar a `make_password` desde el handler metería a Django en `application` |
| Adapter | Estructural | identity | `identity/infrastructure/security/token_issuer.py` | Adaptar PyJWT al puerto `TokenIssuer`: la aplicación pide tokens sin saber cómo se firman | Usar `djangorestframework-simplejwt` no sirve: no pone `kid` en el header |
| Outbox | Integración | identity | `identity/infrastructure/persistence/repositories.py`, `identity/infrastructure/messaging/relay.py` | Guardar el usuario y publicar en Kafka son dos sistemas: si uno falla, quedaría un usuario sin evento o un evento sin usuario | Publicar directo en el handler pierde el evento si Kafka está caído; una transacción distribuida no existe entre PostgreSQL y Kafka |
| Command | Comportamiento | identity | `identity/application/commands/register_user.py` | Encapsular la intención de registrar un usuario, separada de HTTP (CQRS) | Sin `CommandBus` (Mediator): con pocos casos de uso, el handler se invoca directo desde la vista (KISS) |
| Factory Method | Creacional | listing | `domain/model/Property.java` (`Property.create`) | Una propiedad debe nacer en `DRAFT`, con id generado por el dominio, título, precio y zona válidos, y registrar `PropertyCreated`; con un constructor público se podría crear en cualquier estado | Un Builder sobra: los datos obligatorios son pocos; los opcionales (características, imágenes) entran después por métodos con sus propias reglas |
| Service Registry + Self-Registration | Microservicios | listing | `application.properties` (`spring.cloud.consul.*`), `infrastructure/config/ConsulReregistration.java` | Las réplicas de listing (`--scale listing-service=3`) cambian de IP; el gateway necesita saber cuáles están vivas | Registrar a mano en el compose no sigue a `--scale`; el re-registro cada 60 s cubre los reinicios de Consul en modo dev |

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
| CQRS | Arquitectura | listing, visit | Proyección `property_catalog` como lado query en listing; copia local de propiedades en visit alimentada por eventos |
| Event-driven policy (coreografía) | Integración | listing, visit | `LeadClosed` (WON) → reservar; `PropertyReserved` / `PropertySold` → rechazar o cancelar visitas (ADR 0005) |
| Outbox | Integración | listing, visit | Publicación confiable de eventos (ya aplicado en identity) |
| Repository | DDD | todos | Un repositorio por aggregate; el dominio no conoce el ORM |
| Builder | Creacional | listing | Criterios del catálogo público con muchos filtros opcionales |
| Singleton | Creacional | todos | Productor de Kafka y pool de BD con scope singleton del contenedor de DI |
| Adapter | Estructural | listing | `ImageStorage` → almacenamiento local o MinIO |
| Facade | Estructural | frontend | Custom hook por feature (`useCatalog`) que oculta la API y el estado a los componentes smart |
| Observer / Pub-Sub | Comportamiento | todos | Eventos de dominio y Kafka |
| Command | Comportamiento | visit, listing | Comandos CQRS ejecutados por `CommandBus` |
| State | Comportamiento | listing, visit | Transiciones de `PropertyStatus`, `VisitStatus` y del `Lead` |
| Specification | DDD | visit, listing | "Se puede solicitar visita si está PUBLISHED"; filtros combinables del catálogo |
