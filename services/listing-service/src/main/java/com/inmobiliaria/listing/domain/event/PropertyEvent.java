package com.inmobiliaria.listing.domain.event;

import com.inmobiliaria.listing.domain.model.Actor;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import java.time.Instant;

/**
 * Eventos de dominio de Property. Son internos: el mapper de infrastructure/messaging los traduce a
 * los eventos de integración de contracts/events/ con el estado actual del aggregate.
 */
public sealed interface PropertyEvent {

    PropertyId propertyId();

    Instant occurredAt();

    record PropertyCreated(PropertyId propertyId, Instant occurredAt) implements PropertyEvent {}

    record PropertyUpdated(PropertyId propertyId, Instant occurredAt) implements PropertyEvent {}

    record PropertyImagesAdded(PropertyId propertyId, Instant occurredAt) implements PropertyEvent {}

    /** previousStatus distingue una propiedad nueva (DRAFT) de una reanudada o liberada. */
    record PropertyPublished(PropertyId propertyId, PropertyStatus previousStatus, Instant occurredAt)
            implements PropertyEvent {}

    record PropertyPaused(PropertyId propertyId, Instant occurredAt) implements PropertyEvent {}

    record PropertyReserved(PropertyId propertyId, Actor actor, Instant occurredAt) implements PropertyEvent {}

    record PropertySold(PropertyId propertyId, Instant occurredAt) implements PropertyEvent {}

    record PropertyRented(PropertyId propertyId, Instant occurredAt) implements PropertyEvent {}
}
