---
name: adr
description: Registra una decisión de arquitectura (ADR) en docs/adr, por ejemplo la tecnología del gateway, dónde vive Favoritos, el framework del frontend, la base de datos de search o una llamada síncrona entre servicios.
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
3. Si la decisión resuelve un punto de "Decisiones pendientes" de `CLAUDE.md`, actualiza también esa sección y la tabla de servicios en el mismo PR.
4. Sugiere la rama `docs/adr-<tema>` y pedir revisión a todo el equipo: un ADR afecta a todos.
