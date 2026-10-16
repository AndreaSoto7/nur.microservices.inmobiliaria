---
name: caso-de-uso
description: Implementa un caso de uso (comando o consulta) siguiendo DDD, arquitectura limpia y CQRS, del dominio hacia afuera y con tests. Úsala cuando haya que agregar comportamiento de negocio, por ejemplo publicar una propiedad, solicitar o programar una visita, registrar un usuario o marcar como vendida.
argument-hint: "[descripción del caso de uso]"
---

# Caso de uso con DDD + CQRS

Caso de uso: $ARGUMENTS

Sigue `.claude/rules/ddd-clean-architecture.md` y la rule del stack del servicio.

## 1. Clasificar

- **¿Comando o consulta?**
  - Un comando cambia estado: `PublishPropertyCommand`.
  - Una consulta solo lee: `ListAgentPropertiesQuery`. Una consulta nunca modifica nada.
- **¿Qué aggregate toca?** Debe ser uno solo. Si necesitas modificar dos, probablemente falta un evento de dominio: el segundo cambio ocurre al reaccionar al evento.
- **¿Qué invariantes protege?** Escríbelas en una lista antes de programar.
- **¿Emite eventos de integración?** Verifica que existen en `contracts/events/README.md`. Si no, usa antes `/nuevo-evento`.

## 2. Dominio primero (con tests)

1. Escribe los tests de dominio: un caso feliz y uno por cada invariante o transición inválida.
2. Implementa los métodos del aggregate y los value objects necesarios. La regla vive en el aggregate (`property.publish()`), no en el handler.
3. El aggregate registra el evento de dominio. No lo publica.

## 3. Aplicación

- **Comando:** `XxxCommand` (datos inmutables) y `XxxHandler`.
  - El handler: carga el aggregate por repositorio → verifica autorización (¿es el dueño?) → invoca el método de dominio → guarda → los eventos van al outbox.
  - Devuelve void o el ID creado.
- **Consulta:** `XxxQuery` y su handler. Lee una proyección o un DTO directamente y está optimizada para lectura.
- Tests del handler con un repositorio en memoria y un publicador falso. Verifica el estado final y los eventos emitidos.

## 4. Infraestructura

- Implementación del repositorio y mapper entre persistencia y dominio.
- Migración nueva, con el nombre según la convención del stack.
- Mapper del evento de dominio al evento de integración (según el schema de `contracts/events/`) y escritura en el outbox, en la misma transacción.

## 5. Exponerlo

Si necesita endpoint, continúa con `/nuevo-endpoint`. Si el caso de uso usó un patrón de diseño, regístralo con `/aplicar-patron` o directamente en `docs/patrones-de-diseno.md`.

## Checklist de salida

- [ ] El dominio no importa frameworks.
- [ ] Las transiciones inválidas lanzan un error de dominio con un `code` estable.
- [ ] Se modifica un solo aggregate por transacción.
- [ ] Los eventos se escriben en el outbox, no se publican directo.
- [ ] Los tests de dominio y de aplicación pasan.
