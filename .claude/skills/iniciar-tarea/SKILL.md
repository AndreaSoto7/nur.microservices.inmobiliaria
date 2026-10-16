---
name: iniciar-tarea
description: Empieza una tarea nueva del proyecto. Sincroniza con main, crea la rama con el nombre correcto, verifica responsables y contratos, y arma un plan por capas antes de escribir código.
argument-hint: "[servicio] [descripción de la tarea]"
disable-model-invocation: true
allowed-tools:
  - Bash(git status *)
  - Bash(git fetch *)
  - Bash(git branch *)
  - Bash(git log *)
  - Bash(git switch *)
---

# Iniciar tarea

Tarea solicitada: $ARGUMENTS

## 1. Entender la tarea

- Identifica el **servicio** (`identity`, `listing`, `visit`, `search`, `notification`, `gateway`, `frontend`, `contracts`, `infra`, `docs`) y el **tipo** (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`).
- Si falta información, pregunta antes de seguir.
- Revisa la tabla de responsables en `CLAUDE.md`. Si la tarea toca un servicio que tiene otro responsable, adviértelo y sugiere coordinar (issue o PR revisado por esa persona).

## 2. Preparar el repositorio

1. Corre `git status`. Si hay cambios sin commitear, **detente** y pregunta si se hace commit, stash o se descartan. Nunca los descartes por tu cuenta.
2. `git fetch origin`.
3. Crea la rama desde `origin/main`:
   - Comando: `git switch -c <tipo>/<scope>-<descripcion-corta> origin/main`.
   - Nombre en kebab-case, sin tildes, como máximo unas 5 palabras.
   - Ejemplo: `feat/listing-publicar-propiedad`.

## 3. ¿Necesita un contrato primero?

- Si la tarea crea o cambia un **endpoint** o un **evento**, el contrato va primero:
  - Endpoint → `contracts/openapi/`. Evento → `contracts/events/`.
- Si el contrato afecta a otros servicios (consumidores del evento, frontend), propone hacerlo en un **PR separado** (`docs/contracts-...` o `feat/contracts-...`) y esperar la revisión de los afectados antes de implementar.

## 4. Plan por capas

Presenta un plan corto con los archivos que se crearán o modificarán, agrupados así:

- **domain:** aggregate, value objects, eventos de dominio, errores, invariantes.
- **application:** comando o consulta, handler, puertos.
- **infrastructure:** repositorio, migración, outbox, productor o consumidor.
- **presentation:** endpoint, DTOs, mapeo de errores.
- **tests:** de dominio, de aplicación y de integración.
- **docs:** patrón aplicado (`docs/patrones-de-diseno.md`), ADR si hay una decisión de arquitectura.

Indica qué rules de `.claude/rules/` aplican y qué skills conviene usar después: `/caso-de-uso`, `/nuevo-endpoint`, `/nuevo-evento`, `/aplicar-patron`.

**Espera la confirmación del usuario antes de escribir código.**
