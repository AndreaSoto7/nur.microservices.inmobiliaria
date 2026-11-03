# 0004 — Frontend en React

- **Estado:** Propuesto
- **Fecha:** 2026-10-20
- **Autores:** @Tiesol

## Contexto

- La plataforma necesita una UI para interesados y para agentes.
- El ADR 0001 dejó pendiente el framework del frontend.
- Las clases explican el patrón Smart/Dumb con Angular, pero la rule `frontend-smart-dumb` lo plantea como un principio de arquitectura que no depende del framework.

## Opciones consideradas

1. **Angular.**
   - Pros: es el framework de los ejemplos de clase. Trae router, formularios, HTTP e inyección de dependencias.
   - Contras: más estructura y una curva más larga para el equipo.
2. **React** (con Vite y TypeScript).
   - Pros:
     - Smart/Dumb se expresa directo: componentes contenedor con hooks y componentes presentacionales que reciben props y avisan con callbacks.
     - Vite arranca rápido.
     - Ecosistema y documentación amplios.
   - Contras: no trae router ni manejo de datos. Hay que elegir librerías, y la estructura depende de la disciplina del equipo.
3. **Vue.**
   - Pros: simple y con buena documentación.
   - Contras: para este alcance no aporta nada concreto frente a React.

## Decisión

- **React + Vite + TypeScript** en `frontend/`.
- **Puerto de desarrollo:** el que Vite usa por defecto, **5173**. Es el origen permitido por el CORS del gateway.
- **Librerías:** el responsable del frontend elige el router y el manejo de datos del servidor, y las anota en este ADR antes de pasarlo a `Aceptado`.

## Justificación

- Es la elección del equipo.
- Smart/Dumb y SOLID en la UI se pueden aplicar igual de bien en React:
  - **Contenedores:** componentes que usan custom hooks o un facade.
  - **Presentacionales:** componentes puros (`memo`) que reciben props y avisan con callbacks `onX`.

## Consecuencias

- **Se gana:** se desbloquea el frontend.
- **Se pierde o se asume:** las referencias a Angular de las rules y skills (`OnPush`, `@Input`, `@Output`) deben adaptarse a React.
- **Hay que hacer ahora:**
  - Actualizar `CLAUDE.md` (stack y puerto 5173).
  - Ajustar `frontend-smart-dumb`, `/componente-front` y `revisor-frontend` (PR `chore(claude)` aparte).
  - El responsable del frontend completa en este ADR la elección de librerías.
