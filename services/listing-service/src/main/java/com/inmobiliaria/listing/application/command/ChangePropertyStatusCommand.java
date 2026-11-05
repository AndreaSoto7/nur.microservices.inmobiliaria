package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Actor;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.UUID;

/**
 * Las seis transiciones de la máquina de estados (Command): cada una es un objeto con su intención.
 * {@code sealed} hace que el handler cubra todas sin {@code default}: una transición nueva no compila
 * hasta que se maneje.
 */
public sealed interface ChangePropertyStatusCommand {

    PropertyId propertyId();

    UUID agentId();

    /** publishListingCommand. */
    record PublishPropertyCommand(PropertyId propertyId, UUID agentId) implements ChangePropertyStatusCommand {}

    /** pauseListingCommand. */
    record PausePropertyCommand(PropertyId propertyId, UUID agentId) implements ChangePropertyStatusCommand {}

    /**
     * reserveListingCommand. El agente lo pide con actor AGENT; la política LeadClosed despacha el mismo
     * comando con actor SYSTEM y el agentId del evento (si no es el dueño, la propiedad no se encuentra).
     */
    record ReservePropertyCommand(PropertyId propertyId, UUID agentId, Actor actor)
            implements ChangePropertyStatusCommand {}

    /** cancelListingCommand. */
    record ReleaseReservationCommand(PropertyId propertyId, UUID agentId) implements ChangePropertyStatusCommand {}

    /** buyListingCommand. */
    record MarkPropertySoldCommand(PropertyId propertyId, UUID agentId) implements ChangePropertyStatusCommand {}

    /** rentListingCommand. */
    record MarkPropertyRentedCommand(PropertyId propertyId, UUID agentId) implements ChangePropertyStatusCommand {}
}
