---
name: revisar
description: Autorrevisión completa de la rama antes de abrir un PR. Corre lint y tests de los servicios tocados y lanza en paralelo los agentes revisores (arquitectura DDD, API REST, contratos, seguridad, frontend). Devuelve los hallazgos por severidad y el estado del Definition of Done.
disable-model-invocation: true
allowed-tools:
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git fetch *)
  - Bash(git merge-base *)
---

# Revisión antes del PR

## 1. Alcance

1. `git fetch origin`.
2. Lista los cambios con `git diff --stat origin/main...HEAD` más lo no commiteado (`git status --short`).
3. Agrupa los archivos por área: `services/<x>`, `contracts/`, `frontend/`, `gateway/`, `infra/`, `docs/`, `.claude/`.
4. Si toca más de un servicio, adviértelo: lo ideal es un PR por servicio.

## 2. Verificación automática

Por cada servicio tocado, corre build, tests y lint con los comandos de su rule (`.claude/rules/stack-*.md`) y reporta lo que falle.

## 3. Agentes revisores (en paralelo)

Lanza **en un solo mensaje** los agentes que correspondan. A cada uno pásale la lista de archivos cambiados y el comando de diff:

| Si cambió… | Agente |
|---|---|
| Cualquier archivo en `services/` | `arquitecto-ddd` |
| Controladores, DTOs, rutas o `contracts/openapi/` | `revisor-api-rest` |
| `contracts/events/` o código de productores y consumidores | `guardian-contratos` |
| Auth, config, uploads, `infra/`, Dockerfiles o `.env.example` | `revisor-seguridad` |
| `frontend/` | `revisor-frontend` |

## 4. Informe

Consolida los hallazgos sin duplicados, ordenados por severidad:

- 🔴 **Bloqueante:** rompe una regla de oro de `CLAUDE.md`, un contrato, la seguridad o los tests.
- 🟡 **Importante:** viola DDD, SOLID o REST, o falta un test relevante.
- 🔵 **Sugerencia:** legibilidad o nombres.

Cada hallazgo indica archivo:línea, qué pasa y cómo arreglarlo.

Cierra con el **Definition of Done** de `CLAUDE.md`, con cada punto ✅ o ❌.

**No apliques correcciones sin preguntar.** Ofrece arreglar los bloqueantes primero.
