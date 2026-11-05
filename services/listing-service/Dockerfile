# Etapa 1: compila con el wrapper de Maven (aquí quedan el JDK y el repositorio de Maven).
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /build
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src/ src/
RUN ./mvnw -B -q package -DskipTests && cp target/listing-service-*.jar app.jar

# Etapa 2: imagen final, solo con el JRE y el jar. Corre sin root.
FROM eclipse-temurin:21-jre
RUN useradd --create-home --uid 10001 app \
    && mkdir -p /var/lib/listing/images && chown app:app /var/lib/listing/images
WORKDIR /app
COPY --from=builder /build/app.jar app.jar
USER app
EXPOSE 8002

# Sin curl en la imagen: bash abre el socket y revisa la línea de estado.
HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=3 \
    CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/8002 && printf 'GET /health/ready HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n' >&3 && head -1 <&3 | grep -q ' 200'"]

# exec: java es el PID 1 y recibe el SIGTERM de docker stop, así se da de baja en Consul.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
