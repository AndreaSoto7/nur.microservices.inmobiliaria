---
name: crear-pr
description: Prepara y abre un Pull Request siguiendo el flujo del equipo. Hace commits con Conventional Commits, rebase sobre origin/main, push de la rama y gh pr create con la plantilla completa.
disable-model-invocation: true
allowed-tools:
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git fetch *)
  - Bash(git branch *)
  - Bash(git add *)
  - Bash(git commit *)
---

# Crear Pull Request

## 1. Verificaciones previas

- **Rama actual:** si es `main`, **detente**. Ofrece crear una rama con `/iniciar-tarea` y mover los cambios ahí.
- **Revisión previa:** pregunta si ya se corrió `/revisar`. Si no, recomiéndalo, aunque el usuario puede seguir de todos modos.
- **Archivos sensibles:** revisa `git status`. Nunca agregues `.env`, credenciales, `node_modules`, `target/`, `dist/`, `.venv/` ni archivos personales (`CLAUDE.local.md`, `.claude/settings.local.json`).

## 2. Commits

- Agrega solo los archivos relacionados con la tarea, por ruta. Nunca `git add -A` a ciegas.
- Formato `tipo(scope): descripción en español, en imperativo y en minúscula`. Ejemplo: `feat(listing): publicar propiedad y emitir PropertyPublished`.
- Si los cambios mezclan cosas distintas (contrato + implementación), separa en varios commits.

## 3. Sincronizar con main

1. `git fetch origin`.
2. `git rebase origin/main`. **Pide confirmación** antes de ejecutarlo.
3. Si hay conflictos, usa `/resolver-conflicto`.
4. Vuelve a correr los tests del servicio después del rebase.

## 4. Push

- Primera vez: `git push -u origin <rama>`.
- Si rebaseaste una rama ya publicada: `git push --force-with-lease`, **solo** en tu propia rama.
- Ambos comandos piden confirmación.

## 5. Abrir el PR

- **Título:** como el commit principal (`feat(listing): …`).
- **Cuerpo:** completa `.github/pull_request_template.md`:
  - Qué y por qué.
  - Servicio(s).
  - Contratos afectados.
  - Patrones aplicados.
  - Cómo probar.
  - Checklist del DoD marcado con honestidad.
- **Comando:** `gh pr create --base main --title "..." --body-file <archivo temporal>`.
  - Si el PR toca una zona compartida (`contracts/`, `infra/`, `docs/adr/`, `.claude/`, `CLAUDE.md`) o el servicio de otra persona, sugiere agregar a esa persona como revisora (`--reviewer`).
- Si `gh` no está instalado o autenticado, muestra el link `https://github.com/AndreaSoto7/nur.microservices.inmobiliaria/compare/main...<rama>` y el cuerpo listo para pegar.

Termina mostrando la URL del PR.
