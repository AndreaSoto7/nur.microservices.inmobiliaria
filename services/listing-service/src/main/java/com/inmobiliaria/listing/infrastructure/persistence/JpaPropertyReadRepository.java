package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.application.query.PropertyQueries.ListAgentPropertiesQuery;
import com.inmobiliaria.listing.application.query.PropertyQueries.PropertySort;
import com.inmobiliaria.listing.application.query.PropertyReadRepository;
import com.inmobiliaria.listing.application.query.PropertyViews;
import com.inmobiliaria.listing.application.query.PropertyViews.ImageView;
import com.inmobiliaria.listing.application.query.PropertyViews.LocationView;
import com.inmobiliaria.listing.application.query.PropertyViews.MoneyView;
import com.inmobiliaria.listing.application.query.PropertyViews.PageMeta;
import com.inmobiliaria.listing.application.query.PropertyViews.PageView;
import com.inmobiliaria.listing.application.query.PropertyViews.PropertyDetailView;
import com.inmobiliaria.listing.application.query.PropertyViews.PropertySummaryView;
import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.domain.model.PropertyType;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

/** Lado query: lee las filas y arma las vistas de la API sin reconstruir el aggregate. */
@Repository
public class JpaPropertyReadRepository implements PropertyReadRepository {

    private final PropertyJpaRepository jpa;

    public JpaPropertyReadRepository(PropertyJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public PageView<PropertySummaryView> listByAgent(ListAgentPropertiesQuery query) {
        PageRequest pageable = PageRequest.of(query.page() - 1, query.size(), sortOf(query.sort()));
        Page<PropertyJpaEntity> page = query.status() == null
                ? jpa.findByAgentId(query.agentId(), pageable)
                : jpa.findByAgentIdAndStatus(query.agentId(), query.status().name(), pageable);
        List<PropertySummaryView> data = page.getContent().stream().map(JpaPropertyReadRepository::toSummary).toList();
        return new PageView<>(data, new PageMeta(query.page(), query.size(), page.getTotalElements(),
                page.getTotalPages()));
    }

    @Override
    public Optional<PropertyDetailView> findDetail(UUID propertyId) {
        return jpa.findById(propertyId).map(JpaPropertyReadRepository::toDetail);
    }

    private static Sort sortOf(PropertySort sort) {
        // El id desempata: con el mismo orden, las páginas no repiten ni saltan filas.
        Sort primary = switch (sort) {
            case UPDATED_AT_DESC -> Sort.by("updatedAt").descending();
            case UPDATED_AT_ASC -> Sort.by("updatedAt").ascending();
            case CREATED_AT_DESC -> Sort.by("createdAt").descending();
            case CREATED_AT_ASC -> Sort.by("createdAt").ascending();
            case PRICE_ASC -> Sort.by("priceAmount").ascending();
            case PRICE_DESC -> Sort.by("priceAmount").descending();
        };
        return primary.and(Sort.by("id"));
    }

    private static PropertySummaryView toSummary(PropertyJpaEntity entity) {
        String cover = entity.getImages().isEmpty()
                ? null
                : PropertyViews.imageUrl(entity.getId(), entity.getImages().getFirst().getId());
        return new PropertySummaryView(entity.getId(), entity.getTitle(), PropertyType.valueOf(entity.getPropertyType()),
                OperationType.valueOf(entity.getOperationType()), PropertyStatus.valueOf(entity.getStatus()),
                new MoneyView(entity.getPriceAmount(), entity.getPriceCurrency()), entity.getZone(), cover,
                entity.getUpdatedAt());
    }

    private static PropertyDetailView toDetail(PropertyJpaEntity entity) {
        List<Feature> features = entity.getFeatures().stream()
                .map(Feature::valueOf)
                .sorted(Comparator.naturalOrder())
                .toList();
        List<ImageView> images = entity.getImages().stream()
                .map(image -> new ImageView(image.getId(), PropertyViews.imageUrl(entity.getId(), image.getId()),
                        image.getContentType()))
                .toList();
        return new PropertyDetailView(entity.getId(), entity.getAgentId(), entity.getTitle(), entity.getDescription(),
                PropertyType.valueOf(entity.getPropertyType()), OperationType.valueOf(entity.getOperationType()),
                PropertyStatus.valueOf(entity.getStatus()),
                new MoneyView(entity.getPriceAmount(), entity.getPriceCurrency()),
                new LocationView(entity.getZone(), entity.getAddress(), entity.getLatitude(), entity.getLongitude()),
                entity.getBedrooms() == null ? null : entity.getBedrooms().intValue(),
                entity.getBathrooms() == null ? null : entity.getBathrooms().intValue(),
                entity.getAreaM2(), features, images, entity.getPublishedAt(), entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
