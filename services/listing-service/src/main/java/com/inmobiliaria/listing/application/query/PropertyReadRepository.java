package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.query.PropertyQueries.ListAgentPropertiesQuery;
import com.inmobiliaria.listing.application.query.PropertyViews.PageView;
import com.inmobiliaria.listing.application.query.PropertyViews.PropertyDetailView;
import com.inmobiliaria.listing.application.query.PropertyViews.PropertySummaryView;
import java.util.Optional;
import java.util.UUID;

/**
 * Puerto de lectura (lado query de CQRS): devuelve vistas listas para la API, sin pasar por el
 * aggregate. Lo implementa infrastructure/persistence con consultas directas.
 */
public interface PropertyReadRepository {

    PageView<PropertySummaryView> listByAgent(ListAgentPropertiesQuery query);

    Optional<PropertyDetailView> findDetail(UUID propertyId);
}
