# Enunciado — Proyecto 06: Plataforma inmobiliaria para casas y departamentos

Resumen del documento entregado por el docente (Ingeniería Web 3).

## Objetivo

Una plataforma donde una inmobiliaria o un agente publica casas y departamentos (venta o alquiler), y los interesados buscan propiedades, consultan su información, guardan favoritas y solicitan visitas. Además, el sistema permite dar seguimiento a las oportunidades generadas.

## Datos de una publicación

Fotografías, precio, ubicación o zona, tipo de inmueble, dormitorios, baños, superficie, descripción y características relevantes (garaje, jardín, piscina, áreas comunes…).

## Funcionalidades

### Usuarios interesados

- Buscar propiedades por zona, tipo, precio y características.
- Ver fotografías, descripción y datos principales del inmueble.
- Guardar propiedades en favoritos.
- Enviar una consulta o solicitar una visita.
- Consultar el estado de sus solicitudes de visita.

### Inmobiliaria / agentes

- Crear, editar, publicar o pausar propiedades.
- Cargar una galería de imágenes y las características del inmueble.
- Administrar la disponibilidad y el estado de cada publicación.
- Revisar los contactos y las solicitudes de visita recibidas.
- Programar visitas y registrar el seguimiento del interesado.

## Flujo principal

Una propiedad puede recibir múltiples consultas y solicitudes de visita. Conserva su estado durante todo el proceso y puede marcarse como **reservada, vendida, alquilada o pausada**.

## Fuera de alcance

- Pagos, contratos electrónicos y mapas externos reales. La ubicación puede ser texto o coordenadas simuladas.
- **Mejoras opcionales:** recomendaciones, comparación de propiedades, agentes favoritos, métricas de visualización.

## Microservicios sugeridos (referencial)

| Servicio sugerido | Responsabilidad | En nuestro proyecto |
|---|---|---|
| Identity | Registro, autenticación, usuarios, roles | `identity-service` (Django) |
| Property | Propiedades, galería, características, estados | `listing-service` (Spring) |
| Search | Consultas, filtros, vistas optimizadas del catálogo | `search-service` (Go) |
| Lead / Visit | Contactos, solicitudes, programación de visitas | `visit-service` (NestJS) |
| Favorite | Propiedades guardadas | por decidir (ADR) |
| Notification | Avisos ante solicitudes, visitas y cambios | `notification-service` (Go) |

## Criterios técnicos obligatorios (evaluados)

1. **API Gateway** como punto de entrada.
2. **DDD y arquitectura limpia** (dominio, casos de uso, infraestructura).
3. **Persistencia independiente** por microservicio.
4. **CQRS** donde sea pertinente.
5. **Eventos**, por ejemplo `PropertyPublished`, `VisitRequested`, `VisitScheduled`, `PropertyReserved` y `PropertySold`.
6. **Patrones de diseño** aplicados y justificados según el dominio.
