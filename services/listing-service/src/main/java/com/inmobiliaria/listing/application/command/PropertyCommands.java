package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Money;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyType;
import java.util.Set;
import java.util.UUID;

/** Comandos que cambian los datos de una propiedad (CQRS): cada uno es la intención de un caso de uso. */
public final class PropertyCommands {

    private PropertyCommands() {}

    /** createListingCommand del event storming. */
    public record CreatePropertyCommand(UUID agentId, String title, String description, PropertyType type,
            OperationType operation, Money price, Location location) {}

    /** editListingCommand. */
    public record EditPropertyCommand(PropertyId propertyId, UUID agentId, String title, String description,
            Money price, Location location) {}

    /** registerPropertiesCommand. */
    public record UpdatePropertyFeaturesCommand(PropertyId propertyId, UUID agentId, int bedrooms, int bathrooms,
            Area area, Set<Feature> features) {}

    /** updateGalleryCommand: una imagen por comando. El contenido ya viene leído; el tipo se detecta del contenido. */
    public record AddPropertyImageCommand(PropertyId propertyId, UUID agentId, byte[] content) {}
}
