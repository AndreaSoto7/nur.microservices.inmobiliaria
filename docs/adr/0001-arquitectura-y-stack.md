# 0001 — Arquitectura de microservicios y stack por servicio

- **Estado:** Aceptado (stack por servicio) · Propuesto (puntos pendientes)
- **Fecha:** 2026-10-16
- **Autores:** equipo del proyecto

## Contexto

El enunciado exige microservicios con API Gateway, DDD y arquitectura limpia, persistencia independiente, CQRS, eventos y patrones de diseño justificados. El equipo quiere que cada integrante trabaje con un stack distinto, y por eso los servicios deben integrarse solo mediante contratos neutros al lenguaje.

## Decisión

### Stack por servicio (acordado por el equipo)

| Servicio | Stack | Responsabilidad |
|---|---|---|
| identity-service | Django + DRF | Registro, autenticación, roles, emisión de JWT RS256 + JWKS |
| listing-service | Spring Boot | Propiedades, galería, características, estados (lado comando) |
| visit-service | NestJS | Consultas, leads, visitas y seguimiento |
| search-service | Go | Modelo de lectura del catálogo y filtros (lado query) |
| notification-service | Go | Notificaciones a agentes y clientes |
| Mensajería | Apache Kafka (KRaft) | Eventos de integración entre servicios |

### Reglas de integración

- **Monorepo** con una carpeta por servicio, para que los contratos, la infraestructura y las reglas compartidas estén en un solo lugar.
- Comunicación entre servicios **asíncrona por Kafka**: un topic por aggregate, clave = `aggregateId`, envelope JSON común y patrón Outbox en los productores.
- Contratos neutros al lenguaje en `contracts/`: JSON Schema para eventos y OpenAPI 3.1 para HTTP.
- **Base de datos por servicio**, sin acceso cruzado.
- JWT RS256 emitido por identity y validado por cada servicio con JWKS.

## Justificación

- Kafka desacopla servicios escritos en lenguajes distintos y conserva el orden por aggregate, que es clave para los estados de una propiedad.
- Los contratos en formatos estándar evitan compartir código entre lenguajes.
- Separar listing (comandos) de search (lectura) materializa CQRS entre servicios, como pide el enunciado.

## Consecuencias

- Hay consistencia eventual entre listing y search, que se acepta para el catálogo.
- Cada servicio necesita outbox y consumidores idempotentes.
- Hay más infraestructura local (Kafka y varias bases), que se resuelve con `infra/docker-compose.yml`.

## Pendiente de decidir (un ADR nuevo por cada uno)

- [ ] Tecnología del **API Gateway**. Opciones: Spring Cloud Gateway, Traefik, Nginx o KrakenD.
- [ ] Ubicación de **Favoritos**: servicio propio o dentro de listing o visit.
- [ ] **Frontend**. Las clases usan Angular para Smart/Dumb.
- [ ] Base de datos de **search** (PostgreSQL vs. OpenSearch) y de **notification** (PostgreSQL vs. MongoDB).
- [ ] **Versiones exactas** de Python/Django, Java/Spring Boot, Node/NestJS y Go.
