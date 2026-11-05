package com.inmobiliaria.listing.application.command;

import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import java.util.UUID;

/**
 * Autorización de dominio (rule seguridad): un agente solo gestiona sus propiedades. Una ajena se
 * trata igual que una inexistente, para no revelar qué IDs existen.
 */
final class OwnedProperties {

    private OwnedProperties() {}

    static Property load(PropertyRepository repository, PropertyId id, UUID agentId) {
        return repository.findById(id)
                .filter(property -> property.isOwnedBy(agentId))
                .orElseThrow(PropertyNotFoundException::new);
    }
}
