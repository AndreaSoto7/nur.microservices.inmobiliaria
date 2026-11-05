package com.inmobiliaria.listing.application.exception;

/** Error de un caso de uso que no es una regla del aggregate: no existe (404) o no es tuyo (403). */
public abstract class ApplicationException extends RuntimeException {

    private final String code;

    protected ApplicationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
