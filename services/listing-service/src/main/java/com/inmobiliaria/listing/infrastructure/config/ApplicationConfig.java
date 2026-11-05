package com.inmobiliaria.listing.infrastructure.config;

import com.inmobiliaria.listing.application.command.AddFavoriteHandler;
import com.inmobiliaria.listing.application.command.AddPropertyImagesHandler;
import com.inmobiliaria.listing.application.command.CreatePropertyHandler;
import com.inmobiliaria.listing.application.command.EditPropertyHandler;
import com.inmobiliaria.listing.application.command.MarkPropertyRentedHandler;
import com.inmobiliaria.listing.application.command.MarkPropertySoldHandler;
import com.inmobiliaria.listing.application.command.PausePropertyHandler;
import com.inmobiliaria.listing.application.command.PropertyCommandSupport;
import com.inmobiliaria.listing.application.command.PublishPropertyHandler;
import com.inmobiliaria.listing.application.command.ReleaseReservationHandler;
import com.inmobiliaria.listing.application.command.RemoveFavoriteHandler;
import com.inmobiliaria.listing.application.command.ReservePropertyHandler;
import com.inmobiliaria.listing.application.command.UpdatePropertyFeaturesHandler;
import com.inmobiliaria.listing.application.policy.ReserveOnLeadWonPolicy;
import com.inmobiliaria.listing.application.port.CatalogProjection;
import com.inmobiliaria.listing.application.port.Clock;
import com.inmobiliaria.listing.application.port.EventPublisher;
import com.inmobiliaria.listing.application.port.ImageStorage;
import com.inmobiliaria.listing.application.port.ProcessedEventStore;
import com.inmobiliaria.listing.application.query.CatalogReadModel;
import com.inmobiliaria.listing.application.query.GetCatalogPropertyHandler;
import com.inmobiliaria.listing.application.query.GetPropertyByIdHandler;
import com.inmobiliaria.listing.application.query.GetPropertyImageHandler;
import com.inmobiliaria.listing.application.query.ListAgentPropertiesHandler;
import com.inmobiliaria.listing.application.query.ListMyFavoritesHandler;
import com.inmobiliaria.listing.application.query.PropertyReadModel;
import com.inmobiliaria.listing.application.query.SearchCatalogHandler;
import com.inmobiliaria.listing.domain.repository.FavoriteRepository;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Raíz de composición: la capa de aplicación no usa anotaciones de componentes; sus casos de uso se
 * arman aquí con los adaptadores de infraestructura.
 */
@Configuration
public class ApplicationConfig {

    @Bean
    PropertyCommandSupport propertyCommandSupport(PropertyRepository repository, CatalogProjection catalog,
            EventPublisher events, Clock clock) {
        return new PropertyCommandSupport(repository, catalog, events, clock);
    }

    @Bean
    CreatePropertyHandler createPropertyHandler(PropertyCommandSupport support) {
        return new CreatePropertyHandler(support);
    }

    @Bean
    UpdatePropertyFeaturesHandler updatePropertyFeaturesHandler(PropertyCommandSupport support) {
        return new UpdatePropertyFeaturesHandler(support);
    }

    @Bean
    EditPropertyHandler editPropertyHandler(PropertyCommandSupport support) {
        return new EditPropertyHandler(support);
    }

    @Bean
    PublishPropertyHandler publishPropertyHandler(PropertyCommandSupport support) {
        return new PublishPropertyHandler(support);
    }

    @Bean
    PausePropertyHandler pausePropertyHandler(PropertyCommandSupport support) {
        return new PausePropertyHandler(support);
    }

    @Bean
    ReservePropertyHandler reservePropertyHandler(PropertyCommandSupport support) {
        return new ReservePropertyHandler(support);
    }

    @Bean
    ReleaseReservationHandler releaseReservationHandler(PropertyCommandSupport support) {
        return new ReleaseReservationHandler(support);
    }

    @Bean
    MarkPropertySoldHandler markPropertySoldHandler(PropertyCommandSupport support) {
        return new MarkPropertySoldHandler(support);
    }

    @Bean
    MarkPropertyRentedHandler markPropertyRentedHandler(PropertyCommandSupport support) {
        return new MarkPropertyRentedHandler(support);
    }

    @Bean
    AddPropertyImagesHandler addPropertyImagesHandler(PropertyCommandSupport support, ImageStorage storage) {
        return new AddPropertyImagesHandler(support, storage);
    }

    @Bean
    AddFavoriteHandler addFavoriteHandler(PropertyRepository properties, FavoriteRepository favorites, Clock clock) {
        return new AddFavoriteHandler(properties, favorites, clock);
    }

    @Bean
    RemoveFavoriteHandler removeFavoriteHandler(FavoriteRepository favorites) {
        return new RemoveFavoriteHandler(favorites);
    }

    @Bean
    ReserveOnLeadWonPolicy reserveOnLeadWonPolicy(ProcessedEventStore processedEvents,
            PropertyRepository properties, ReservePropertyHandler reserve) {
        return new ReserveOnLeadWonPolicy(processedEvents, properties, reserve);
    }

    @Bean
    ListAgentPropertiesHandler listAgentPropertiesHandler(PropertyReadModel readModel) {
        return new ListAgentPropertiesHandler(readModel);
    }

    @Bean
    GetPropertyByIdHandler getPropertyByIdHandler(PropertyRepository properties) {
        return new GetPropertyByIdHandler(properties);
    }

    @Bean
    SearchCatalogHandler searchCatalogHandler(CatalogReadModel catalog) {
        return new SearchCatalogHandler(catalog);
    }

    @Bean
    GetCatalogPropertyHandler getCatalogPropertyHandler(PropertyRepository properties) {
        return new GetCatalogPropertyHandler(properties);
    }

    @Bean
    ListMyFavoritesHandler listMyFavoritesHandler(PropertyReadModel readModel) {
        return new ListMyFavoritesHandler(readModel);
    }

    @Bean
    GetPropertyImageHandler getPropertyImageHandler(PropertyReadModel readModel, ImageStorage storage) {
        return new GetPropertyImageHandler(readModel, storage);
    }
}
