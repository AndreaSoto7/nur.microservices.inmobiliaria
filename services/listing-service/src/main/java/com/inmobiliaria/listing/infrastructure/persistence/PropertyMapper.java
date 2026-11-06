package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Amenity;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Money;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyImage;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.domain.model.PropertyType;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Traduce entre el aggregate Property y sus entidades JPA. */
final class PropertyMapper {

    private PropertyMapper() {
    }

    static Property toDomain(PropertyJpaEntity e) {
        Set<Amenity> features = e.features.isEmpty() ? EnumSet.noneOf(Amenity.class)
                : e.features.stream().map(Amenity::valueOf).collect(Collectors.toCollection(
                        () -> EnumSet.noneOf(Amenity.class)));
        return Property.reconstitute(
                new PropertyId(e.id), e.agentId, e.title, e.description,
                PropertyType.valueOf(e.propertyType), OperationType.valueOf(e.operationType),
                PropertyStatus.valueOf(e.status), new Money(e.priceAmount, e.priceCurrency),
                new Location(e.zone, e.address, e.latitude, e.longitude),
                e.bedrooms == null ? null : e.bedrooms.intValue(),
                e.bathrooms == null ? null : e.bathrooms.intValue(),
                e.areaM2 == null ? null : new Area(e.areaM2),
                features,
                e.images.stream().map(i -> new PropertyImage(i.id, i.contentType, i.sizeBytes, i.storageKey,
                        i.uploadedAt)).toList(),
                e.publishedAt, e.createdAt, e.updatedAt);
    }

    /** Copia el estado del aggregate sobre la entidad (nueva o ya cargada en el contexto de persistencia). */
    static void copy(Property p, PropertyJpaEntity e) {
        e.agentId = p.agentId();
        e.title = p.title();
        e.description = p.description();
        e.propertyType = p.type().name();
        e.operationType = p.operation().name();
        e.status = p.status().name();
        e.priceAmount = p.price().amount();
        e.priceCurrency = p.price().currency();
        e.zone = p.location().zone();
        e.address = p.location().address();
        e.latitude = p.location().latitude();
        e.longitude = p.location().longitude();
        e.bedrooms = p.bedrooms().map(Integer::shortValue).orElse(null);
        e.bathrooms = p.bathrooms().map(Integer::shortValue).orElse(null);
        e.areaM2 = p.area().map(Area::squareMeters).orElse(null);
        e.publishedAt = p.publishedAt().orElse(null);
        e.createdAt = p.createdAt();
        e.updatedAt = p.updatedAt();

        Set<String> features = p.amenities().stream().map(Amenity::name).collect(Collectors.toSet());
        e.features.retainAll(features);
        e.features.addAll(features);

        Set<java.util.UUID> known = e.images.stream().map(i -> i.id).collect(Collectors.toSet());
        List<PropertyImage> images = p.images();
        for (int position = 0; position < images.size(); position++) {
            PropertyImage image = images.get(position);
            if (!known.contains(image.id())) {
                e.images.add(new PropertyImageJpaEntity(image.id(), (short) position, image.contentType(),
                        (int) image.sizeBytes(), image.storageKey(), image.uploadedAt()));
            }
        }
    }
}
