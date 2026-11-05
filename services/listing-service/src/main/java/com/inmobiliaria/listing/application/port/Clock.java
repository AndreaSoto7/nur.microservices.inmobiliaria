package com.inmobiliaria.listing.application.port;

import java.time.Instant;

/** Hora actual inyectable: los tests no dependen de la hora real (rule testing). */
public interface Clock {

    Instant now();
}
