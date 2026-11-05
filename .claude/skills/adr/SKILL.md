---
name: adr
description: Registra una decisión de arquitectura (ADR) en docs/adr, por ejemplo el stack de audit-service, las versiones de cada stack, una política nueva entre servicios o una llamada síncrona entre servicios.
argument-hint: "[título de la decisión]"
disable-model-invocation: true
---

# Architecture Decision Record

Decisión: $ARGUMENTS

1. Busca el último número en `docs/adr/` y usa el siguiente (`0002`, `0003`, …). El archivo se llama `docs/adr/NNNN-titulo-en-kebab-case.md`.
2. Copia la estructura de `docs/adr/0000-plantilla.md` y completa:
   - **Contexto:** qué problema o requisito obliga a decidir. Cita el enunciado si aplica.
   - **Opciones consideradas:** al menos 2, con pros y contras.
   - **Decisión** y **justificación**.
   - **Consecuencias:** qué se gana, qué se pierde y qué hay que hacer ahora.
   - **Estado:** `Propuesto`. Pasa a `Aceptado` cuando el equipo lo apruebe en el PR.
3. En el mismo PR, lleva la decisión a donde los agentes la van a leer:
   - Si resuelve un punto de "Decisiones pendientes" del `CLAUDE.md` raíz, quítalo de ahí y actualiza el mapa de componentes si cambia.
   - Si afecta a un componente, actualiza su `CLAUDE.md` (ficha, decisiones técnicas, eventos).
   - Si una decisión anterior queda reemplazada, marca el ADR viejo como `Reemplazado por NNNN`.
4. Sugiere la rama `docs/adr-<tema>` y pedir revisión a todo el equipo: un ADR afecta a todos.
