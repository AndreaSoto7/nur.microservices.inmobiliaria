package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Feature;
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
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Traduce entre el aggregate y sus filas. Mapper explícito: el dominio no conoce JPA. */
final class PropertyMapper {

    private PropertyMapper() {}

    static Property toDomain(PropertyJpaEntity entity) {
        Set<Feature> features = EnumSet.noneOf(Feature.class);
        entity.getFeatures().forEach(feature -> features.add(Feature.valueOf(feature)));
        List<PropertyImage> images = entity.getImages().stream()
                .map(image -> new PropertyImage(image.getId(), image.getContentType(), image.getSizeBytes(),
                        image.getStorageKey(), image.getUploadedAt()))
                .toList();
        return Property.reconstitute(new Property.State(
                new PropertyId(entity.getId()),
                entity.getAgentId(),
                PropertyType.valueOf(entity.getPropertyType()),
                OperationType.valueOf(entity.getOperationType()),
                entity.getTitle(),
                entity.getDescription(),
                new Money(entity.getPriceAmount(), entity.getPriceCurrency()),
                new Location(entity.getZone(), entity.getAddress(), entity.getLatitude(), entity.getLongitude()),
                toInteger(entity.getBedrooms()),
                toInteger(entity.getBathrooms()),
                entity.getAreaM2() == null ? null : new Area(entity.getAreaM2()),
                features,
                images,
                PropertyStatus.valueOf(entity.getStatus()),
                entity.getPublishedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getVersion()));
    }

    /** Copia el estado del aggregate sobre la entidad (nueva o cargada) sin perder las imágenes ya guardadas. */
    static void copy(Property property, PropertyJpaEntity entity) {
        entity.setAgentId(property.agentId());
        entity.setTitle(property.title());
        entity.setDescription(property.description());
        entity.setPropertyType(property.type().name());
        entity.setOperationType(property.operation().name());
        entity.setStatus(property.status().name());
        entity.setPriceAmount(property.price().amount());
        entity.setPriceCurrency(property.price().currency());
        entity.setZone(property.location().zone());
        entity.setAddress(property.location().address());
        entity.setLatitude(property.location().latitude());
        entity.setLongitude(property.location().longitude());
        entity.setBedrooms(property.bedrooms().map(Integer::shortValue).orElse(null));
        entity.setBathrooms(property.bathrooms().map(Integer::shortValue).orElse(null));
        entity.setAreaM2(property.area().map(Area::squareMeters).orElse(null));
        entity.setPublishedAt(property.publishedAt().orElse(null));
        entity.setCreatedAt(property.createdAt());
        entity.setUpdatedAt(property.updatedAt());

        entity.getFeatures().clear();
        property.features().forEach(feature -> entity.getFeatures().add(feature.name()));

        syncImages(property.images(), entity);
    }

    /** La posición es el orden de la galería del dominio. Las imágenes que ya no están se borran. */
    private static void syncImages(List<PropertyImage> images, PropertyJpaEntity entity) {
        Map<UUID, PropertyImageJpaEntity> saved = entity.getImages().stream()
                .collect(Collectors.toMap(PropertyImageJpaEntity::getId, Function.identity()));
        Set<UUID> current = images.stream().map(PropertyImage::id).collect(Collectors.toSet());
        entity.getImages().removeIf(image -> !current.contains(image.getId()));
        for (int position = 0; position < images.size(); position++) {
            PropertyImage image = images.get(position);
            PropertyImageJpaEntity row = saved.get(image.id());
            if (row == null) {
                entity.getImages().add(new PropertyImageJpaEntity(image.id(), entity, (short) position,
                        image.contentType(), Math.toIntExact(image.sizeBytes()), image.storageKey(),
                        image.uploadedAt()));
            } else {
                row.setPosition((short) position);
            }
        }
    }

    private static Integer toInteger(Short value) {
        return value == null ? null : value.intValue();
    }
}
