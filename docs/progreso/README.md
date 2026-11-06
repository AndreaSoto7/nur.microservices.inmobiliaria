# Progreso por servicio

Hay un archivo por componente. Lo que el componente **es** (dominio, eventos, estructura) está en su `CLAUDE.md`; aquí solo va **qué está hecho y qué falta**. Cada archivo tiene dos secciones:

- **Historial:** cada `feat` o `fix` que se entregó, con su PR. Lo más reciente va arriba.
- **Pendientes:** lo que falta, como checklist. Se tacha (`[x]`) cuando el PR que lo resuelve se abre.

| Archivo | Responsable |
|---|---|
| [identity-service.md](identity-service.md) | @Tiesol |
| [listing-service.md](listing-service.md) | @AndreaSoto7 |
| [visit-service.md](visit-service.md) | _(completar)_ |
| [notification-service.md](notification-service.md) | _(completar)_ |
| [audit-service.md](audit-service.md) | _(completar)_ · opcional (ADR 0005) |
| [gateway.md](gateway.md) | @Tiesol |
| [frontend.md](frontend.md) | _(completar)_ |
| [infra.md](infra.md) | Zona compartida |

## Regla (también está en el Definition of Done de `CLAUDE.md`)

**Cada PR de `feat` o `fix` actualiza el archivo de su servicio en el mismo PR:**

1. Agrega una fila al **Historial**: tipo, qué se hizo (en una línea) y el número de PR.
2. Tacha o agrega **Pendientes** según corresponda. Si en la revisión aparece algo que se decide hacer después, se anota aquí como pendiente.

Así cualquiera ve en un minuto qué está hecho y qué falta en cada servicio, sin revisar PR por PR.

- **Si el número de PR todavía no existe:** se escribe `este PR` y se reemplaza después con un commit chico.
- **El estado del PR** (en revisión o mergeado) no se anota aquí: se ve en GitHub.
- **Cada responsable edita solo el archivo de su servicio.** Así no hay conflictos entre ramas.

## Plantilla para una fila del historial

```markdown
| feat | Registro de usuario (`POST /api/v1/auth/register`) | #8, #9 |
```
