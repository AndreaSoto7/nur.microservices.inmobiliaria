# 0006 — Linter de Java en listing: Checkstyle

- **Estado:** Propuesto
- **Fecha:** 2026-11-06
- **Autores:** @AndreaSoto7

## Contexto

- El Definition of Done pide que cada PR "compile y pase lint y formato en el componente tocado".
- listing-service (Spring Boot, Java 21) no tenía linter. El `CLAUDE.md` raíz lo dejó como decisión pendiente: Spotless o Checkstyle.
- El servicio ya tiene unas 140 clases con un estilo uniforme: 4 espacios, líneas de hasta 120 caracteres y tests con nombres `should_hacer_algo`.

## Opciones consideradas

1. **Spotless** (con google-java-format o palantir-java-format).
   - Pros: formatea solo (`spotless:apply`) y no hay discusiones de estilo.
   - Contras: google-java-format usa 2 espacios y reformatearía todo el servicio, con un diff enorme que la regla "no reformatees archivos que no tocaste" pide evitar. Además, solo revisa el formato, no detecta errores como `equals` sin `hashCode` o un `catch` vacío.
2. **Checkstyle** con reglas propias.
   - Pros: revisa estilo **y** errores comunes, y la configuración se adapta al estilo que ya tiene el código. Corre en `validate`, así `./mvnw test` ya lo incluye.
   - Contras: no formatea solo. Cada violación se arregla a mano.
3. **Las dos.** Hoy agrega herramientas y configuración sin un beneficio claro (KISS).

## Decisión

- **Checkstyle** (`maven-checkstyle-plugin` 3.6.0 con Checkstyle 10.26.1) en `services/listing-service/pom.xml`, en la fase `validate`, con `failOnViolation`. Revisa también los tests.
- Las reglas están en `services/listing-service/config/checkstyle/checkstyle.xml`:
  - Formato: sin tabs, salto de línea final y 120 columnas.
  - Imports: sin comodines, repetidos ni sin usar.
  - Nombres: se permite `should_x` en los tests y `log` para el logger.
  - Llaves siempre y una sentencia por línea.
  - Errores comunes: `equals`/`hashCode`, `==` entre strings, `catch` vacío, `switch` que cae al siguiente caso, y no capturar `Throwable` ni `Error`.
- No se agrega formateador automático.

## Justificación

- Cumple el "lint" del Definition of Done sin reformatear el código existente: el PR que lo agrega solo corrige 8 líneas.
- Detecta errores, no solo formato, y eso pesa más en la evaluación de DDD y arquitectura limpia que el estilo.

## Consecuencias

- **Se gana:** `./mvnw test` y `./mvnw verify` fallan si hay violaciones, y la imagen Docker también (copia `config/`).
- **Se asume:** sin formateador automático, el estilo depende de cada uno. Si el equipo lo quiere más adelante, se puede agregar Spotless con palantir-java-format (4 espacios) en otro ADR.
- **Hecho:** se quitó la decisión de "Decisiones pendientes" del `CLAUDE.md` raíz y se documentó en `services/listing-service/CLAUDE.md`.
