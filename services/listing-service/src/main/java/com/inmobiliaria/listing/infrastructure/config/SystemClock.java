package com.inmobiliaria.listing.infrastructure.config;

import com.inmobiliaria.listing.application.port.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Component;

/** Hora real en UTC, con precisión de microsegundos (la de timestamptz). */
@Component
public class SystemClock implements Clock {

    @Override
    public Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}
