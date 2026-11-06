package com.inmobiliaria.listing.support;

import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Copia el estado al guardar y reconstruye en cada lectura, como haría la base. */
public class InMemoryPropertyRepository implements PropertyRepository {

    private final Map<PropertyId, Property> store = new HashMap<>();

    @Override
    public Optional<Property> findById(PropertyId id) {
        return Optional.ofNullable(store.get(id)).map(InMemoryPropertyRepository::copy);
    }

    @Override
    public void save(Property property) {
        store.put(property.id(), copy(property));
    }

    @Override
    public List<PropertyId> findAllIds() {
        return List.copyOf(store.keySet());
    }

    public Property get(PropertyId id) {
        return store.get(id);
    }

    public int size() {
        return store.size();
    }

    private static Property copy(Property p) {
        return Property.reconstitute(p.id(), p.agentId(), p.title(), p.description(), p.type(), p.operation(),
                p.status(), p.price(), p.location(), p.bedrooms().orElse(null), p.bathrooms().orElse(null),
                p.area().orElse(null), p.amenities(), p.images(), p.publishedAt().orElse(null), p.createdAt(),
                p.updatedAt());
    }
}
