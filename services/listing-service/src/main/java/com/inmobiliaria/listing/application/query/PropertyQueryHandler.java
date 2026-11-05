package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.application.port.ImageStorage;
import com.inmobiliaria.listing.application.query.PropertyQueries.GetPropertyImageQuery;
import com.inmobiliaria.listing.application.query.PropertyQueries.GetPropertyQuery;
import com.inmobiliaria.listing.application.query.PropertyQueries.ImageContent;
import com.inmobiliaria.listing.application.query.PropertyQueries.ListAgentPropertiesQuery;
import com.inmobiliaria.listing.application.query.PropertyViews.PageView;
import com.inmobiliaria.listing.application.query.PropertyViews.PropertyDetailView;
import com.inmobiliaria.listing.application.query.PropertyViews.PropertySummaryView;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyImage;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Consultas del agente y de las imágenes. Ninguna cambia estado. */
@Service
@Transactional(readOnly = true)
public class PropertyQueryHandler {

    private final PropertyReadRepository reads;
    private final PropertyRepository properties;
    private final ImageStorage storage;

    public PropertyQueryHandler(PropertyReadRepository reads, PropertyRepository properties, ImageStorage storage) {
        this.reads = reads;
        this.properties = properties;
        this.storage = storage;
    }

    public PageView<PropertySummaryView> handle(ListAgentPropertiesQuery query) {
        return reads.listByAgent(query);
    }

    /** El agente ve las suyas en cualquier estado; una ajena es un 404. */
    public PropertyDetailView handle(GetPropertyQuery query) {
        return reads.findDetail(query.propertyId())
                .filter(view -> view.agentId().equals(query.agentId()))
                .orElseThrow(PropertyNotFoundException::new);
    }

    /**
     * Pública mientras la propiedad no esté en DRAFT o PAUSED (vendidas y alquiladas siguen visibles
     * para el historial de visit). En DRAFT o PAUSED solo la ve el dueño.
     */
    public ImageContent handle(GetPropertyImageQuery query) {
        Property property = properties.findById(new PropertyId(query.propertyId()))
                .filter(found -> isVisible(found, query))
                .orElseThrow(PropertyNotFoundException::new);
        PropertyImage image = property.images().stream()
                .filter(candidate -> candidate.id().equals(query.imageId()))
                .findFirst()
                .orElseThrow(PropertyNotFoundException::new);
        byte[] content = storage.load(image.storageKey()).orElseThrow(PropertyNotFoundException::new);
        return new ImageContent(image.contentType(), content, !isHidden(property));
    }

    private static boolean isVisible(Property property, GetPropertyImageQuery query) {
        return !isHidden(property) || (query.viewerId() != null && property.isOwnedBy(query.viewerId()));
    }

    private static boolean isHidden(Property property) {
        return property.status() == PropertyStatus.DRAFT || property.status() == PropertyStatus.PAUSED;
    }
}
