package com.inmobiliaria.listing.domain.exception;

/**
 * Un value object o un campo del aggregate recibió un dato inválido (precio, zona, título, imagen).
 * Es un error de los datos enviados, no un conflicto de estado: la API lo traduce a 400.
 */
public class InvalidValueException extends DomainException {

    public InvalidValueException(String code, String message) {
        super(code, message);
    }
}
