package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.common.PageRequest;
import com.inmobiliaria.listing.application.common.PageResult;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Consultas que leen directo de properties y favorites, sin pasar por el aggregate. Nunca escriben. */
public interface PropertyReadModel {

    Set<String> SORTABLE_FIELDS = Set.of("createdAt", "updatedAt", "price", "title");

    PageResult<PropertySummaryView> listByAgent(UUID agentId, Optional<PropertyStatus> status, PageRequest page);

    PageResult<FavoriteView> listFavorites(UUID userId, PageRequest page);

    Optional<ImageLocation> findImage(UUID propertyId, UUID imageId);

    record ImageLocation(String propertyStatus, String contentType, String storageKey) {
    }
}
