---
paths:
  - "services/**"
  - "gateway/**"
  - "frontend/**"
  - "infra/**"
  - "**/docker-compose*.yml"
  - "**/.env.example"
---

# Seguridad

## Autenticación y tokens

- identity firma los JWT con **RS256**. La clave privada solo la tiene identity; el resto valida con la clave pública publicada en el JWKS.
- El access token dura 15 min, con refresh token. Claims: `sub` (UUID del usuario), `email`, `roles`, `iss=identity-service`, `aud=inmobiliaria`.
- Cada servicio valida firma, `exp`, `iss` y `aud`. Nunca confíes en headers como `X-User-Id` que lleguen de fuera del gateway.
- Las contraseñas se guardan con el hasher de Django (PBKDF2 o Argon2). Nunca en texto plano ni con hashes propios.

## Autorización (mínimo privilegio)

- Cada endpoint declara qué roles acceden.
- La **propiedad del recurso** se verifica en la capa de aplicación:
  - Un agente solo gestiona sus propiedades y las visitas de esas propiedades.
  - Un cliente solo ve sus consultas, visitas, favoritos y notificaciones.
- Cada servicio usa su propio usuario de base de datos, con permisos solo sobre su base.

## Entrada y salida

- Valida toda entrada: tipos, rangos, longitudes y enums.
- Las consultas a la base van con ORM o parámetros. **Nunca concatenes SQL.**
- **Subida de imágenes:**
  - Valida el tipo MIME real (jpeg, png, webp) y el tamaño (máximo 5 MB por imagen).
  - Renombra con un UUID.
  - Nunca uses el nombre original como ruta.
- Los errores no exponen stack traces, SQL ni rutas internas (formato problem+json).

## Secretos y configuración

- Los secretos van en variables de entorno. Nunca en el código, el compose ni los tests versionados.
- `.env.example` lista todas las variables con valores de ejemplo, nunca reales.
- Los logs no incluyen contraseñas, tokens, headers `Authorization` ni datos personales completos.

## Gateway

- CORS restringido a los orígenes del frontend.
- Rate limit en login y registro.
- Solo el gateway expone puertos públicos en producción. En desarrollo los servicios exponen puertos para depurar.
