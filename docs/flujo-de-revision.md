# Cómo revisamos, aprobamos y mergeamos PRs

Guía corta para todo el equipo. Si es la primera vez que revisas un PR en GitHub, empieza por la sección 2.

## 1. Las reglas, en una tabla

| Quién | Qué hace | Qué **no** hace |
|---|---|---|
| **Autor del PR** | Abre el PR, responde los comentarios, corrige y **mergea su propio PR** una vez aprobado | No aprueba su propio PR (GitHub no lo permite) |
| **Revisor** (cualquier otra persona del equipo) | Lee el cambio, comenta y **aprueba** o **pide cambios** | **No mergea** PRs de otros, aunque estén aprobados |
| **Todos** | Trabajan en su rama y hacen push solo de su rama | No hacen push a `main` ni `--force` sobre ramas ajenas |

Por qué mergea el autor:
- Muchos PRs están **encadenados**: uno se apoya en el anterior.
- Si alguien mergea fuera de orden, la cadena se rompe y hay que rehacer ramas.
- El autor es quien sabe en qué orden van y quien rebasea el siguiente.

## 2. Cómo revisar y aprobar un PR (paso a paso)

1. Entra al repo en GitHub → pestaña **Pull requests** → abre el PR.
2. Lee la descripción: dice **qué** cambia, **por qué**, el **orden de merge** y **cómo probarlo**.
3. Ve a la pestaña **Files changed** y lee el código.
   - Para comentar una línea, pasa el mouse por encima y haz clic en el **+** azul.
4. Arriba a la derecha, haz clic en **Review changes** y elige una opción:
   - **Approve** si está bien. Puedes dejar un comentario como "LGTM" o lo que veas.
   - **Request changes** si hay algo que debe corregirse antes de entrar. Explica qué y por qué.
   - **Comment** si solo tienes preguntas o sugerencias que no bloquean.
5. Clic en **Submit review**. **Listo: no toques el botón "Merge pull request".**

### Desde la terminal (opcional)

```bash
gh pr list                          # PRs abiertos
gh pr view 9 --web                  # abrir el PR 9 en el navegador
gh pr diff 9                        # ver el cambio en la terminal
gh pr review 9 --approve -b "LGTM"  # aprobar
gh pr review 9 --request-changes -b "Falta validar X porque Y"
```

## 3. Qué mirar al revisar (checklist corto)

No hace falta ser experto en el stack del otro: con estas preguntas alcanza para una buena revisión.

- [ ] ¿La descripción explica qué y por qué? ¿Entiendes el cambio?
- [ ] ¿Toca solo **un servicio**, o una zona compartida con motivo?
- [ ] Si cambia una API o un evento, ¿está primero en `contracts/`?
- [ ] ¿Hay **tests** para la lógica nueva? ¿El PR dice que pasan?
- [ ] ¿Hay secretos (contraseñas, claves, tokens, `.env`)? No debería haber **ninguno**.
- [ ] ¿Los nombres siguen el lenguaje ubicuo de `CLAUDE.md` (`Property`, `Visit`, `Lead`…)?
- [ ] ¿Tiene menos de ~1000 líneas? Si es más grande, pide que se divida.

Si el PR cambia un **contrato** que tu servicio consume (por ejemplo, un evento que escuchas o los claims del JWT), revísalo con más cuidado: un contrato roto rompe tu servicio.

## 4. Cómo saber en qué estado está un PR

En la lista de PRs de GitHub, o con `gh pr list` / `gh pr view <número>`:

| Estado | Qué significa | Qué hace el autor |
|---|---|---|
| Sin revisión (*Review required*) | Nadie lo revisó todavía | Avisar al grupo |
| **Approved** | Tiene la aprobación necesaria | Mergear (sección 5) |
| **Changes requested** | El revisor pidió cambios | Corregir, hacer push y avisar para que revise de nuevo |

## 5. Cómo mergea el autor

1. Comprueba que el PR esté **Approved** y que su **base sea `main`**.
2. Botón **Squash and merge**. Nunca "Create a merge commit" ni "Rebase and merge".
   - Desde la terminal: `gh pr merge <número> --squash`.
   - Si trabajas con Claude Code, también puede hacerlo él: verifica que el PR esté aprobado y **pide confirmación antes de cada merge**.
3. El título del squash queda como el título del PR (Conventional Commits en español).

### PRs encadenados (stacked)

Cuando un PR tiene como base **otra rama** y no `main`, se mergea **después** de su base, en orden. Por ejemplo, `#8 → chore/identity-scaffold` va después de #7.

Después de mergear la base, el autor actualiza el PR siguiente:

```bash
gh pr edit <siguiente> --base main
git switch <rama-siguiente> && git fetch origin
git rebase --onto origin/main origin/<rama-base-ya-mergeada>
git push --force-with-lease          # solo en tu propia rama
```

Hace falta porque el squash crea un commit nuevo en `main`. Sin el rebase, el PR siguiente mostraría otra vez los cambios que ya entraron.

## 6. Qué NO hacer

- No mergear PRs de otra persona, aunque estén aprobados.
- No hacer push directo a `main`.
- No hacer `git push --force` sobre ramas que no son tuyas. En la tuya, usa solo `--force-with-lease`.
- No aprobar sin mirar: "Approve" significa "lo leí y está bien".
- No resolver un conflicto de `contracts/` sin hablar con el responsable del servicio que produce ese contrato.

## 7. Recomendación para la dueña del repo

Hoy estas reglas son un **acuerdo del equipo**: con permiso de escritura, GitHub deja que cualquiera apriete "Merge". Para que el repo las haga cumplir, quien administra el repo puede activar en **Settings**:

- **Branches → Branch protection rule para `main`:**
  - Require a pull request before merging, con 1 approval.
  - Dismiss stale approvals when new commits are pushed.
  - Require conversation resolution before merging.
  - Do not allow bypassing the above settings.
- **General → Pull Requests:**
  - Dejar activo solo **Allow squash merging**.
  - Activar **Automatically delete head branches**: al mergear un PR, GitHub cambia solo la base de los PRs encadenados a `main`. El rebase de la sección 5 sigue haciendo falta.
- **Opcional:** un archivo `.github/CODEOWNERS`, para que cada servicio y `contracts/` pidan revisión a su responsable de forma automática.
