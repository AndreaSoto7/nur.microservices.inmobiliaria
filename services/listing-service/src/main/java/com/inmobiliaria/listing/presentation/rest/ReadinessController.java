package com.inmobiliaria.listing.presentation.rest;

import java.util.Map;
import org.springframework.boot.health.actuate.endpoint.HealthDescriptor;
import org.springframework.boot.health.actuate.endpoint.HealthEndpoint;
import org.springframework.boot.health.contributor.Status;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /health/ready}: el grupo {@code ready} de Actuator (revisa la base). Actuator solo deja
 * publicar un grupo en una ruta de un segmento ({@code /health}, que es el liveness), así que esta
 * ruta de dos segmentos se sirve aquí.
 */
@RestController
public class ReadinessController {

    private static final String READY_GROUP = "ready";

    private final HealthEndpoint health;

    public ReadinessController(HealthEndpoint health) {
        this.health = health;
    }

    @GetMapping(value = "/health/ready", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> ready() {
        HealthDescriptor descriptor = health.healthForPath(READY_GROUP);
        boolean up = descriptor != null && Status.UP.equals(descriptor.getStatus());
        return ResponseEntity.status(up ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("status", up ? "UP" : "DOWN"));
    }
}
