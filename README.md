# Plataforma Inmobiliaria — Microservicios

Proyecto 06 de Ingeniería Web 3: plataforma para publicar casas y departamentos (venta o alquiler), buscarlos con filtros, guardarlos en favoritos y gestionar consultas y visitas.

| Componente | Stack |
|---|---|
| gateway | Go (gateway propio con balanceador de carga) |
| identity-service | Django |
| listing-service | Spring Boot (incluye el catálogo público con filtros) |
| visit-service | NestJS |
| audit-service (opcional) | por decidir |
| frontend | React + Vite + TypeScript |
| Mensajería | Kafka |
| Service discovery | Consul |

Antes de empezar, lee [`CLAUDE.md`](CLAUDE.md): reglas del equipo, convenciones, flujo de trabajo y el enlace al `CLAUDE.md` de cada componente. Las decisiones de arquitectura están en [`docs/adr/`](docs/adr/) (alcance actual: [ADR 0005](docs/adr/0005-realinear-servicios-y-cadenas-de-eventos.md)).
