# Progreso — frontend

- **Responsable:** _(completar)_
- **Stack:** React + Vite + TypeScript (ADR 0004)
- **Instrucciones:** [`frontend/CLAUDE.md`](../../frontend/CLAUDE.md)

## Historial

| Tipo | Qué se hizo | PR |
|---|---|---|
| feat | Mis propiedades (agente), parte 2: crear un borrador y editar sus datos, precio y ubicación | este PR |
| feat | Mis propiedades (agente), parte 1: lista con filtro por estado y cambios de estado, con confirmación si son irreversibles. El cliente HTTP ahora admite headers propios, multipart y 201 sin body | #91 |
| feat | Mejora visual, parte 2: buscador con "Más filtros", orden junto a los resultados, esqueleto de carga, estado vacío sin filtros y convenciones en `docs/convenciones-frontend.md` | #89 |
| feat | Mejora visual, parte 1: paleta y tokens, cabecera, detalle de propiedad, ingreso, registro, mi cuenta y favicon propio | #88 |
| feat | Catálogo público con filtros en la URL (zona, tipo, operación, precio, dormitorios, características), orden y paginación, y detalle de propiedad con galería | #49 |
| feat | Imagen Docker con nginx sin root, CSP y cabeceras de seguridad, SPA con caché correcta y servicio `frontend` en el compose | #48 |
| feat | Proyecto base (Vite 8, React 19, TS estricto, React Router 7, TanStack Query 5, Vitest, ESLint + Prettier), cliente HTTP vía gateway con renovación de sesión, registro, login, logout, ruta protegida y "Mi cuenta" | #42 |

## Pendientes

**Base**

- [x] Proyecto Vite + TypeScript, estructura `core/`, `shared/ui/` y `features/` (`frontend/CLAUDE.md`)
- [x] Elegir el router y la librería de datos (completar el ADR 0004)
- [x] Cliente HTTP vía gateway, manejo de tokens y rutas protegidas
- [x] Probar contra el stack real: registro no, pero login, mi cuenta, recarga de sesión y cierre de sesión sí, en navegador contra nginx, el gateway e identity
- [x] CSP y cabeceras de seguridad (`default-src 'self'`, `connect-src` al gateway, `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`) en el nginx que sirve el build
- [ ] Más adelante, evaluar con identity y gateway (ADR) pasar el refresh token a cookie `HttpOnly; SameSite=Strict`
- [ ] Actualizar en el `CLAUDE.md` raíz la decisión pendiente de librerías del frontend (zona compartida: lo hace su responsable)

**Interesados (enunciado)**

- [x] Registro y login
- [x] Catálogo con filtros (zona, tipo, operación, precio, dormitorios, características), orden y paginación
- [x] Detalle de propiedad con galería
- [ ] Probar el catálogo vía gateway con propiedades reales (vacío ya responde bien; con datos solo se probó simulado)
- [ ] Pantalla de avisos (notification ya tiene API)
- [ ] Favoritos
- [ ] Enviar una consulta y solicitar una visita
- [ ] Mis visitas (estado de las solicitudes)

**Agentes (enunciado)**

- [x] Mis propiedades: lista, publicar, pausar, reservar, marcar vendida o alquilada
- [x] Crear y editar propiedades
- [ ] Galería y características
- [ ] Consultas y solicitudes recibidas; programar visitas y seguimiento

**Más adelante**

- [ ] Empaquetar componentes reutilizables (pospuesto: no está en el enunciado)
