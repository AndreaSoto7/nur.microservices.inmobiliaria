package com.inmobiliaria.listing.application.exception;

/**
 * La propiedad no existe, o existe pero no es del agente que la pide. No se distinguen (contrato):
 * así no se revela qué IDs existen. Se responde 404.
 */
public class PropertyNotFoundException extends RuntimeException {

    public static final String CODE = "PROPERTY_NOT_FOUND";

    public PropertyNotFoundException() {
        super("La propiedad no existe");
    }
}
