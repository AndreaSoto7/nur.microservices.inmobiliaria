package com.inmobiliaria.listing.application.exception;

/** Un agente intenta cambiar una propiedad que no es suya (→ 403). */
public class NotPropertyOwnerException extends ApplicationException {

    public NotPropertyOwnerException() {
        super("PROPERTY_NOT_OWNER", "Solo el agente dueño puede gestionar esta propiedad");
    }
}
