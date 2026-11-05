# visit-service

Base local de Visit en NestJS y TypeScript estricto. Usa Node.js 24 LTS (24.15 o posterior en la serie 24) y npm.

## Ejecutar

Desde la carpeta `services/visit-service`:

```bash
npm ci
npm run start:dev
```

`SERVICE_PORT` configura el puerto del servidor HTTP. El valor predeterminado es 8003.

| Ruta | Respuesta |
| --- | --- |
| `GET /health` | `200 {"status":"UP"}` si el proceso HTTP responde |
| `GET /health/ready` | `200 {"status":"UP"}` si responde la base local, que aún no usa dependencias externas |

## Verificar

```bash
npm run build
npm run lint
npm test
```

El modelo de dominio inicia cada visita en `REQUESTED` y exige que la fecha propuesta sea posterior a la fecha de solicitud. La propiedad y sus participantes se referencian por ID. El flujo HTTP de visitas, la persistencia y las integraciones se incorporan en las siguientes etapas. El contrato se revisa en el PR #39.
