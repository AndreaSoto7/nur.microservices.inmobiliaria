package com.inmobiliaria.listing.domain.exception;

/**
 * Una regla de negocio rechazó la operación. La API la traduce a 409 con su {@code code} estable.
 */
public class DomainException extends RuntimeException {

    private final String code;

    public DomainException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
