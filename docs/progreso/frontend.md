# Progreso — frontend

- **Responsable:** _(completar)_
- **Stack:** React + Vite + TypeScript (ADR 0004)
- **Instrucciones:** [`frontend/CLAUDE.md`](../../frontend/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | Catálogo público con filtros en la URL (zona, tipo, operación, precio, dormitorios, características), orden y paginación, y detalle de propiedad con galería | #49 |
| feat | Imagen Docker con nginx sin root, CSP y cabeceras de seguridad, SPA con caché correcta y servicio `frontend` en el compose | #48 |
| feat | Proyecto base (Vite 8, React 19, TS estricto, React Router 7, TanStack Query 5, Vitest, ESLint + Prettier), cliente HTTP vía gateway con renovación de sesión, registro, login, logout, ruta protegida y "Mi cuenta" | #42 |

## Pendientes

**Base**

- [x] Proyecto Vite + TypeScript, estructura `core/`, `shared/ui/` y `features/` (`frontend/CLAUDE.md`)
- [x] Elegir el router y la librería de datos (completar el ADR 0004)
- [x] Cliente HTTP vía gateway, manejo de tokens y rutas protegidas
- [ ] Probar contra el stack real: hoy el gateway no rutea (solo tiene `/health`), así que el login se probó con tests y no en el navegador
- [x] CSP y cabeceras de seguridad (`default-src 'self'`, `connect-src` al gateway, `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`) en el nginx que sirve el build
- [ ] Más adelante, evaluar con identity y gateway (ADR) pasar el refresh token a cookie `HttpOnly; SameSite=Strict`
- [ ] Actualizar en el `CLAUDE.md` raíz la decisión pendiente de librerías del frontend (zona compartida: lo hace su responsable)

**Interesados (enunciado)**

- [x] Registro y login
- [x] Catálogo con filtros (zona, tipo, operación, precio, dormitorios, características), orden y paginación
- [x] Detalle de propiedad con galería
- [ ] Probar el catálogo vía gateway (hoy se probó contra listing con un proxy local de Vite, porque el gateway no rutea)
- [ ] Favoritos
- [ ] Enviar una consulta y solicitar una visita
- [ ] Mis visitas (estado de las solicitudes)

**Agentes (enunciado)**

- [ ] Mis propiedades: crear, editar, publicar y pausar
- [ ] Galería y características
- [ ] Consultas y solicitudes recibidas; programar visitas y seguimiento

**Más adelante**

- [ ] Empaquetar componentes reutilizables (pospuesto: no está en el enunciado)
