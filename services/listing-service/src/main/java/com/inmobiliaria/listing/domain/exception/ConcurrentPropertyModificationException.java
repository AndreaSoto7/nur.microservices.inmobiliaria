package com.inmobiliaria.listing.domain.exception;

/**
 * Otra operación cambió la propiedad entre que se cargó y se guardó (bloqueo optimista). Pasa, por
 * ejemplo, si el agente pausa justo cuando la política LeadClosed la reserva. Se responde 409.
 */
public class ConcurrentPropertyModificationException extends DomainException {

    public ConcurrentPropertyModificationException() {
        super("PROPERTY_CONCURRENT_MODIFICATION",
                "La propiedad cambió mientras se procesaba la operación. Vuelve a intentarlo");
    }
}
