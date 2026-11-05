package com.inmobiliaria.listing.domain.exception;

/** La máquina de estados de un aggregate no permite la transición pedida. */
public class InvalidStateTransitionException extends DomainException {

    public static final String CODE = "PROPERTY_INVALID_TRANSITION";

    public InvalidStateTransitionException(String message) {
        super(CODE, message);
    }
}
