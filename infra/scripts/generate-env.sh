#!/usr/bin/env bash
# Genera infra/.env con secretos aleatorios (no se sube a git). No pisa uno que ya exista.
# En Windows, córrelo desde Git Bash, que trae openssl.
set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"

if [ -e "$ENV_FILE" ]; then
  echo "infra/.env ya existe: no lo toco. Bórralo a mano si quieres regenerarlo." >&2
  exit 1
fi

# La clave va en una sola línea, con los saltos escapados: comillas simples para que quede literal.
private_key="$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null | awk 'NF {printf "%s\\n", $0}')"

umask 077
cat > "$ENV_FILE" <<ENV
IDENTITY_SECRET_KEY=$(openssl rand -hex 32)
IDENTITY_DB_PASSWORD=$(openssl rand -hex 16)
LISTING_DB_PASSWORD=$(openssl rand -hex 16)
IDENTITY_JWT_PRIVATE_KEY='$private_key'
ENV

echo "Listo: infra/.env generado."
