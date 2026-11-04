FROM golang:1.27-alpine AS build
WORKDIR /src
# go.sum* porque un módulo sin dependencias no lo tiene.
COPY go.mod go.sum* ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/gateway ./cmd/gateway

FROM alpine:3.22
RUN adduser -D -H -u 10001 gateway
COPY --from=build /out/gateway /usr/local/bin/gateway
USER gateway
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${GATEWAY_PORT:-8080}/health" || exit 1
ENTRYPOINT ["gateway"]
