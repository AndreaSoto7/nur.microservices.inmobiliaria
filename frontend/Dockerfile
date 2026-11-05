# Etapa 1: build de Vite. VITE_API_BASE_URL se fija al compilar (Vite la incrusta en el bundle).
FROM node:22-alpine AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Etapa 2: nginx sin root sirve los estáticos con CSP y cabeceras de seguridad.
FROM nginxinc/nginx-unprivileged:1.27-alpine
# Los *.template los procesa envsubst al arrancar (solo las variables definidas: $uri queda intacto).
COPY nginx/ /etc/nginx/templates/
COPY --from=builder /build/dist /usr/share/nginx/html
# Origen del gateway para la CSP (connect-src e img-src). Debe coincidir con VITE_API_BASE_URL.
ENV API_ORIGIN=http://localhost:8080
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
