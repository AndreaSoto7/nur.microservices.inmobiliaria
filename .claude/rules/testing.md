---
paths:
  - "services/**"
  - "frontend/**"
---

# Testing

## Pirámide

1. **Dominio (la mayoría):**
   - Tests unitarios puros, sin framework ni base de datos.
   - Cubren cada invariante y cada transición de estado, incluidas las inválidas.
2. **Aplicación:**
   - Handlers de comandos y consultas con repositorios en memoria y un `EventPublisher` falso.
   - Verifican el resultado y los eventos emitidos.
3. **Integración:**
   - Repositorios contra una base real (Testcontainers o el compose).
   - Controladores con el framework de test del stack.
4. **Contrato:**
   - Validan que los eventos producidos y consumidos cumplen el JSON Schema de `contracts/events/`.
   - Validan que las respuestas coinciden con el OpenAPI.

## Reglas

- Formato **Arrange / Act / Assert**, un comportamiento por test.
- El nombre del test describe la regla: `should_reject_publish_when_property_is_sold` o `"rechaza publicar si la propiedad está vendida"`.
- Los tests no dependen de que otro microservicio esté corriendo.
- Los tests no dependen del orden ni de la hora real: inyecta un `Clock`.
- Si arreglas un bug, primero escribe el test que lo reproduce.
- Usa test data builders en vez de copiar objetos gigantes.

## Herramientas por stack

| Servicio | Tests | Lint / formato |
|---|---|---|
| identity (Django) | `pytest` + `pytest-django` | `ruff check .` · `ruff format .` |
| listing (Spring) | JUnit 5, AssertJ, Mockito, `@WebMvcTest`, `@DataJpaTest` → `./mvnw test` | Spotless (si se adopta) |
| visit (NestJS) | Jest → `npm run test` | ESLint + Prettier → `npm run lint` |
| search, notification (Go) | `go test ./...` (table-driven) | `gofmt`, `go vet`, `golangci-lint run` |
| gateway (Go) | `go test ./...` con `net/http/httptest`: servicios falsos y discovery falso, sin Consul real | `gofmt`, `go vet`, `golangci-lint run` |
| frontend (React) | Vitest + React Testing Library → `npm run test` | ESLint + Prettier → `npm run lint` |

Ningún test depende de que Consul esté corriendo. El registro en Consul se prueba contra un servidor HTTP falso que verifica el body del `PUT`.
