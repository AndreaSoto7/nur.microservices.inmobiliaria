package com.inmobiliaria.listing.support;

import com.inmobiliaria.listing.domain.model.Actor;
import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Money;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyImage;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.domain.model.PropertyType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Test data builder de Property: deja la propiedad en el estado pedido por el camino válido. */
public final class PropertyMother {

    public static final Instant T0 = Instant.parse("2026-10-16T14:30:00Z");
    public static final UUID AGENT = UUID.fromString("8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d");

    private PropertyMother() {
    }

    public static Property draft(OperationType operation) {
        return Property.create(AGENT, "Casa con jardín en Equipetrol", "Dos plantas", PropertyType.HOUSE,
                operation, Money.bob(new BigDecimal("1285000.00")), Location.ofZone("Equipetrol"), T0);
    }

    public static Property draft() {
        return draft(OperationType.SALE);
    }

    /** DRAFT con datos completos y una foto: lista para publicar. */
    public static Property readyToPublish(OperationType operation) {
        Property property = draft(operation);
        property.updateFeatures(3, 2, new Area(new BigDecimal("240.5")), Set.of(Feature.GARAGE, Feature.GARDEN),
                T0);
        property.addImage(jpeg(property), T0);
        return property;
    }

    public static Property inStatus(PropertyStatus status, OperationType operation) {
        Property property = readyToPublish(operation);
        if (status == PropertyStatus.DRAFT) {
            property.pullEvents();
            return property;
        }
        property.publish(T0);
        switch (status) {
            case PAUSED -> property.pause(T0);
            case RESERVED -> property.reserve(Actor.AGENT, T0);
            case SOLD -> property.markSold(T0);
            case RENTED -> property.markRented(T0);
            default -> {
            }
        }
        property.pullEvents();
        return property;
    }

    public static Property inStatus(PropertyStatus status) {
        return inStatus(status, status == PropertyStatus.RENTED ? OperationType.RENT : OperationType.SALE);
    }

    public static PropertyImage jpeg(Property property) {
        UUID id = UUID.randomUUID();
        return new PropertyImage(id, "image/jpeg", 1024, property.id() + "/" + id + ".jpg", T0);
    }
}
