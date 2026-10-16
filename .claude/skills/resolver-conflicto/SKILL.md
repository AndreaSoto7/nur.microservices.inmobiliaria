---
name: resolver-conflicto
description: Guía para resolver conflictos de merge o rebase sin perder trabajo de nadie, con estrategias específicas para código, lockfiles, migraciones de base de datos, contratos y archivos de configuración del equipo.
disable-model-invocation: true
allowed-tools:
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git show *)
---

# Resolver conflictos

## 1. Diagnóstico

- Corre `git status` para saber si hay un **rebase** o un **merge** en curso y qué archivos están en conflicto.
- Muestra la lista y clasifica cada archivo con la tabla de abajo.
- **No ejecutes `git rebase --abort`, `git merge --abort`, `git reset` ni `git checkout -- <archivo>` sin confirmación explícita.**

## 2. Estrategia por tipo de archivo

| Tipo | Cómo resolver |
|---|---|
| **Código fuente** | Lee las dos versiones y el commit de cada lado (`git log -1 <commit>`). Combina la intención de ambos. **Nunca** elijas "ours" o "theirs" sin entender qué hacía el otro cambio. |
| **Lockfiles** (`package-lock.json`, `go.sum`) | Toma la versión de `main` y regenera: `npm install` (y después `npm ci` para verificar) o `go mod tidy`. Nunca edites el lockfile a mano. |
| **Migraciones de BD** | Nunca combines el contenido de dos migraciones. Django: conserva ambas y crea `makemigrations --merge`. Flyway: si chocan las versiones, renombra **tu** migración con un timestamp nuevo. TypeORM: regenera la tuya si quedó desfasada. Nunca modifiques una migración que ya está en `main`. |
| **Contratos** (`contracts/`) | Detente y coordina con el responsable del servicio productor. Un mal merge de contrato rompe a varios servicios. |
| **OpenAPI / código generado** | Regenera desde la fuente en vez de mezclar a mano. |
| **`CLAUDE.md`, `.claude/`, docs** | Conserva el contenido de ambos lados y ordénalo. Si se contradicen, pregunta al usuario. |
| **`docker-compose`, `.env.example`** | Une ambas listas de servicios y variables, y verifica que no haya puertos duplicados. |

## 3. Cerrar

1. Quita todos los marcadores `<<<<<<<`, `=======` y `>>>>>>>`. Verifícalo con `git diff --check`.
2. Corre build y tests del servicio afectado.
3. `git add <archivos>` y luego `git rebase --continue` (o `git commit` si era un merge). Pide confirmación antes.
4. Si algo salió mal, `git reflog` permite volver a un estado anterior. Explícale al usuario cómo hacerlo antes de usarlo.

## Prevención (recuérdalo al terminar)

- Rebase sobre `origin/main` al menos una vez al día.
- PRs chicos y de un solo servicio.
- No reformatear archivos ajenos.
- Avisar en el grupo antes de tocar zonas compartidas.
