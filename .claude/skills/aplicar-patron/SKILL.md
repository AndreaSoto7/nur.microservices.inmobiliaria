---
name: aplicar-patron
description: Elige, implementa y justifica un patrón de diseño (Factory Method, Builder, Singleton, Adapter, Decorator, Facade, Observer, Strategy, Command, State, Specification, Repository) para un problema concreto del proyecto, y lo registra en docs/patrones-de-diseno.md para la defensa. Úsala cuando haya un problema de diseño o cuando se pida aplicar un patrón.
argument-hint: "[problema o patrón] [servicio]"
---

# Aplicar un patrón de diseño

Pedido: $ARGUMENTS

Sigue `.claude/rules/patrones-diseno.md` y `.claude/rules/principios-solid.md`.

## 1. Nombrar el problema

Escribe en una o dos frases el problema concreto. Por ejemplo: "cada canal de notificación nuevo obliga a modificar el handler con otro `if`".

Si no hay un problema real, dilo y recomienda no aplicar el patrón (KISS / YAGNI).

## 2. Evaluar opciones

Compara de 1 a 3 alternativas, incluida siempre "la solución más simple sin patrón":

| Opción | Cómo resuelve el problema | Costo / complejidad | Principio SOLID que favorece |
|---|---|---|---|

Recomienda una y espera la confirmación si la decisión no es obvia.

## 3. Implementar de forma idiomática

- Usa las herramientas del stack: DI de Spring o Nest, interfaces implícitas de Go, protocolos o ABC de Python, `input()`/`output()` de Angular.
- Respeta las capas. Los puertos van en `domain` o `application`; los adaptadores, en `infrastructure`.
- Agrega tests que demuestren el beneficio. Por ejemplo: una estrategia nueva se agrega sin tocar el código existente.

## 4. Registrar (obligatorio)

Agrega una fila en `docs/patrones-de-diseno.md`:

| Patrón | Categoría | Servicio | Archivo(s) | Problema que resuelve | Por qué este y no otro |
|---|---|---|---|---|---|

## 5. Preparar la defensa

Al final, escribe un resumen de 3 o 4 líneas que el equipo pueda usar al exponer: qué problema había, qué patrón se aplicó, dónde está y qué ganamos.
