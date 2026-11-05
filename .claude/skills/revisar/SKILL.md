---
name: revisar
description: Autorrevisión completa de la rama antes de abrir un PR. Corre lint y tests de los servicios tocados, recorre los checklists de API REST y frontend, y lanza solo el agente revisor que corresponda (arquitectura DDD, contratos o seguridad). Devuelve los hallazgos por severidad y el estado del Definition of Done.
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

Por cada componente tocado, corre build, tests y lint con los comandos de la sección "Comandos" de su `CLAUDE.md` y reporta lo que falle.

Verifica también que el `CLAUDE.md` del componente siga describiendo lo que hay: si el cambio agregó o cambió eventos, tablas, rutas, comandos o estructura, y el `CLAUDE.md` no lo refleja, es un hallazgo 🟡.

## 3. Checklists (sin agente)

Recórrelos tú mismo. Reporta cada punto como ✅, ❌ o N/A.

**Si cambiaron controladores, DTOs, rutas, `contracts/openapi/` o `gateway/`** (rule `api-rest`, y `gateway/CLAUDE.md` si es el gateway):

1. Recursos en plural y kebab-case bajo `/api/v1`; acciones de dominio como `POST /{recurso}/{id}/{accion}`.
2. Métodos HTTP con su semántica real.
3. Status codes correctos (201 al crear, 409 en conflictos, 401 vs. 403) y errores problem+json con `code` estable.
4. Colecciones con filtros, paginación (`page` desde 1, `size` máximo 100), orden y envoltorio `{ data, page }`.
5. Roles por endpoint y verificación de propiedad del recurso en la capa de aplicación.
6. `Idempotency-Key` en `POST /inquiries` y `POST /visits`.
7. Compatibilidad con v1.
8. **La implementación coincide con `contracts/openapi/<servicio>-service.yaml`:** rutas, campos, tipos, status y errores. Cualquier diferencia es un hallazgo.
9. JSON en camelCase, fechas ISO-8601 UTC, dinero como `{ amount, currency }`, IDs UUID.

**Si cambió `frontend/`** (`frontend/CLAUDE.md`):

1. Ningún "componente Dios": fetch, estado, lógica y render en un mismo componente.
2. Los dumb no usan hooks de datos ni del router, no llaman a la API y no modifican sus props.
3. Los smart componen dumbs, manejan `loading`, `error` y `empty`, y llaman a la API por el hook de la feature o por `core/`.
4. Los tipos coinciden con `contracts/openapi/` y todo pasa por el gateway.
5. TypeScript sin `any`, `key` estable en listas y accesibilidad básica.

## 3.5. Agentes revisores

Los agentes consumen muchos tokens: **lanza un solo agente por PR**, el del riesgo principal, y solo si aplica. Pásale la lista de archivos, el comando de diff y la ruta del `CLAUDE.md` del componente revisado.

| Si el cambio principal es… | Agente |
|---|---|
| Auth, tokens, uploads, `gateway/`, `infra/`, Dockerfiles, Consul o `.env.example` | `revisor-seguridad` |
| `contracts/` o productores y consumidores de eventos | `guardian-contratos` |
| Dominio, casos de uso o capas en `services/` | `arquitecto-ddd` |
| Solo docs, rules o un cambio chico | Ninguno: basta con los checklists |

Si un cambio toca seguridad y dominio, prioriza `revisor-seguridad`. Agrega un segundo agente solo si el riesgo lo justifica.

## 4. Informe

Consolida los hallazgos sin duplicados, ordenados por severidad:

- 🔴 **Bloqueante:** rompe una regla de oro de `CLAUDE.md`, un contrato, la seguridad o los tests.
- 🟡 **Importante:** viola DDD, SOLID o REST, o falta un test relevante.
- 🔵 **Sugerencia:** legibilidad o nombres.

Cada hallazgo indica archivo:línea, qué pasa y cómo arreglarlo.

Cierra con el **Definition of Done** de `CLAUDE.md`, con cada punto ✅ o ❌.

**No apliques correcciones sin preguntar.** Ofrece arreglar los bloqueantes primero.
