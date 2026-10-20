# Plataforma Inmobiliaria — Microservicios

Proyecto 06 de Ingeniería Web 3: plataforma para publicar casas y departamentos (venta o alquiler), buscarlos con filtros, guardarlos en favoritos y gestionar consultas y visitas.

| Componente | Stack |
|---|---|
| gateway | Go (gateway propio con balanceador de carga) |
| identity-service | Django |
| listing-service | Spring Boot |
| visit-service | NestJS |
| search-service | Go |
| notification-service | Go |
| frontend | React + Vite + TypeScript |
| Mensajería | Kafka |
| Service discovery | Consul |

Antes de empezar, lee [`CLAUDE.md`](CLAUDE.md): reglas del equipo, convenciones y flujo de trabajo. Las decisiones de arquitectura están en [`docs/adr/`](docs/adr/).
