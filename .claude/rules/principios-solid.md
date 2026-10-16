---
paths:
  - "services/**"
  - "gateway/**"
  - "frontend/**"
---

# Principios de diseño (SOLID, KISS, DRY, YAGNI, mínimo privilegio)

Aplica a todo el código del proyecto. Si una solución viola uno de estos principios, dilo y propone la alternativa.

## SOLID con ejemplos de este dominio

- **S — Responsabilidad única.** Una clase o módulo tiene una sola razón para cambiar.
  - `PublishPropertyHandler` orquesta el caso de uso; `Property.publish()` valida la regla; `KafkaEventPublisher` publica.
  - Un controlador no valida reglas de negocio ni habla con Kafka.
- **O — Abierto/cerrado.** Agrega comportamiento sin modificar lo que ya funciona.
  - Un canal de notificación nuevo (email, in-app) es una implementación nueva de `NotificationChannel`, no un `if` más.
- **L — Sustitución de Liskov.** Cualquier implementación de un puerto debe poder reemplazar a otra sin romper al que la usa.
  - `InMemoryPropertyRepository` (tests) y `JpaPropertyRepository` cumplen el mismo contrato, incluidos los errores.
- **I — Segregación de interfaces.** Interfaces chicas y enfocadas en quien las consume.
  - `PropertyReader` y `PropertyWriter` en vez de un `PropertyService` con 20 métodos.
  - En Go, la interfaz se declara en el paquete que la usa.
- **D — Inversión de dependencias.** El dominio y la aplicación dependen de abstracciones (puertos). La infraestructura las implementa y se inyecta (DI de Spring o Nest, constructores en Go, factories en Django).

## Otros principios de la materia

- **KISS:** la solución más simple que cumple el requisito. Nada de capas, genéricos ni abstracciones "por si acaso".
- **DRY dentro de un servicio:** extrae lógica repetida a funciones o value objects.
  - **Entre microservicios se tolera la duplicación** (DTOs, enums): compartir librerías de dominio acopla los servicios.
  - Lo único compartido son los contratos de `contracts/`.
- **YAGNI:** no implementes funcionalidad que el enunciado no pide hasta terminar el alcance obligatorio.
- **Mínimo privilegio:** cada servicio, usuario de base de datos, rol y token tiene solo los permisos que necesita. Un `CLIENT` no puede editar propiedades; un `AGENT` solo edita las suyas.

## Señales de alarma (code smells) que se corrigen

- Clases o componentes "Dios" que hacen de todo: datos, reglas, UI, llamadas HTTP.
- Funciones de más de ~30 líneas o con más de 3 niveles de anidación.
- Modelo anémico: entidades con solo getters/setters y las reglas desperdigadas en servicios.
- Números y strings mágicos. Usa constantes, enums o value objects.
- Comentarios que explican *qué* hace el código en vez de *por qué*.
- Parámetros booleanos que cambian el comportamiento (`create(true)`): sepáralos en dos métodos.
- `catch` vacíos o errores tragados.
