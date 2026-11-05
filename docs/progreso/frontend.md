# Progreso — frontend

- **Responsable:** _(completar)_
- **Stack:** React + Vite + TypeScript (ADR 0004)
- **Instrucciones:** [`frontend/CLAUDE.md`](../../frontend/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | Proyecto base (Vite 8, React 19, TS estricto, React Router 7, TanStack Query 5, Vitest, ESLint + Prettier), cliente HTTP vía gateway con renovación de sesión, registro, login, logout, ruta protegida y "Mi cuenta" | este PR |

## Pendientes

**Base**

- [x] Proyecto Vite + TypeScript, estructura `core/`, `shared/ui/` y `features/` (`frontend/CLAUDE.md`)
- [x] Elegir el router y la librería de datos (completar el ADR 0004)
- [x] Cliente HTTP vía gateway, manejo de tokens y rutas protegidas
- [ ] Probar contra el stack real: hoy el gateway no rutea (solo tiene `/health`), así que el login se probó con tests y no en el navegador
- [ ] CSP y cabeceras de seguridad (`default-src 'self'`, `connect-src` al gateway, `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`) en el servidor que sirva el build, cuando exista su Dockerfile
- [ ] Más adelante, evaluar con identity y gateway (ADR) pasar el refresh token a cookie `HttpOnly; SameSite=Strict`
- [ ] Actualizar en el `CLAUDE.md` raíz la decisión pendiente de librerías del frontend (zona compartida: lo hace su responsable)

**Interesados (enunciado)**

- [x] Registro y login
- [ ] Catálogo con filtros (zona, tipo, precio, características)
- [ ] Detalle de propiedad con galería
- [ ] Favoritos
- [ ] Enviar una consulta y solicitar una visita
- [ ] Mis visitas (estado de las solicitudes)

**Agentes (enunciado)**

- [ ] Mis propiedades: crear, editar, publicar y pausar
- [ ] Galería y características
- [ ] Consultas y solicitudes recibidas; programar visitas y seguimiento

**Más adelante**

- [ ] Empaquetar componentes reutilizables (pospuesto: no está en el enunciado)
