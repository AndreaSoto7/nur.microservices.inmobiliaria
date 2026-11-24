package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.domain.model.PropertyId;
import java.util.UUID;

/** Mover una foto a la posición indicada de la galería; 0 es la portada. */
public record MovePropertyImageCommand(PropertyId propertyId, UUID imageId, int position, CommandMetadata metadata) {
}
