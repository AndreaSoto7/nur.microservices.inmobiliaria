FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/notification-service ./cmd/notification-service

FROM alpine:3.22
RUN adduser -D -H -u 10001 notification
COPY --from=build /out/notification-service /usr/local/bin/notification-service
USER notification
EXPOSE 8005
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${SERVICE_PORT:-8005}/health/ready" || exit 1
ENTRYPOINT ["notification-service"]
