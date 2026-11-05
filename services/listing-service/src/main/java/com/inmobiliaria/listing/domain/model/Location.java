package com.inmobiliaria.listing.domain.model;

import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import java.math.BigDecimal;

/**
 * Ubicación. La zona es obligatoria (es el filtro principal del catálogo); dirección y coordenadas
 * son opcionales, pero latitud y longitud van juntas.
 */
public record Location(String zone, String address, BigDecimal latitude, BigDecimal longitude) {

    private static final int MAX_ZONE = 100;
    private static final int MAX_ADDRESS = 255;
    private static final int COORDINATE_SCALE = 6;
    private static final BigDecimal MAX_LATITUDE = BigDecimal.valueOf(90);
    private static final BigDecimal MAX_LONGITUDE = BigDecimal.valueOf(180);

    public Location {
        zone = zone == null ? "" : zone.strip();
        if (zone.isEmpty() || zone.length() > MAX_ZONE) {
            throw invalid("La zona es obligatoria y tiene como máximo " + MAX_ZONE + " caracteres");
        }
        address = address == null || address.isBlank() ? null : address.strip();
        if (address != null && address.length() > MAX_ADDRESS) {
            throw invalid("La dirección tiene como máximo " + MAX_ADDRESS + " caracteres");
        }
        if ((latitude == null) != (longitude == null)) {
            throw invalid("La latitud y la longitud van juntas");
        }
        if (latitude != null && (latitude.abs().compareTo(MAX_LATITUDE) > 0
                || longitude.abs().compareTo(MAX_LONGITUDE) > 0)) {
            throw invalid("Coordenadas fuera de rango");
        }
        // numeric(9,6): con más decimales la base redondearía y el evento diría otra cosa que la base.
        if (latitude != null && (latitude.stripTrailingZeros().scale() > COORDINATE_SCALE
                || longitude.stripTrailingZeros().scale() > COORDINATE_SCALE)) {
            throw invalid("Las coordenadas admiten como máximo " + COORDINATE_SCALE + " decimales");
        }
    }

    public static Location ofZone(String zone) {
        return new Location(zone, null, null, null);
    }

    private static InvalidValueException invalid(String message) {
        return new InvalidValueException("PROPERTY_INVALID_LOCATION", message);
    }
}
