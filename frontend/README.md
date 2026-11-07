# frontend

UI de la Plataforma Inmobiliaria para interesados y agentes. React 19 · Vite 8 · TypeScript · puerto **5173**.

El diseño (Smart/Dumb, estructura, sesión) está en [`CLAUDE.md`](CLAUDE.md); lo hecho y lo que falta, en [`docs/progreso/frontend.md`](../docs/progreso/frontend.md).

## Correr

```bash
cd frontend
npm ci
cp .env.example .env.local   # VITE_API_BASE_URL apunta al gateway
npm run dev                  # http://localhost:5173
```

El frontend habla **solo con el gateway** (`http://localhost:8080`), nunca con un microservicio directo.

### En Docker (como en la demo)

```bash
docker compose -f infra/docker-compose.yml up -d --build frontend   # http://localhost:5173
```

nginx sirve el build con CSP y cabeceras de seguridad. La URL del gateway se fija al compilar (`VITE_API_BASE_URL`) y la CSP la toma de `API_ORIGIN`: si cambias una, cambia la otra.

## Comandos

| Comando          | Qué hace                                                       |
| ---------------- | -------------------------------------------------------------- |
| `npm run dev`    | Servidor de desarrollo en el puerto 5173                       |
| `npm run test`   | Vitest + React Testing Library (sin backend: `fetch` mockeado) |
| `npm run lint`   | ESLint + Prettier (solo revisa)                                |
| `npm run format` | Prettier (corrige el formato)                                  |
| `npm run build`  | Chequeo de tipos y build de producción en `dist/`              |

## Pantallas

| Ruta        | Pantalla                                             | Acceso     |
| ----------- | ---------------------------------------------------- | ---------- |
| `/`         | Inicio (el catálogo llega cuando listing lo exponga) | Público    |
| `/register` | Crear cuenta como interesado o agente                | Público    |
| `/login`    | Ingresar                                             | Público    |
| `/account`  | Mi cuenta                                            | Con sesión |
