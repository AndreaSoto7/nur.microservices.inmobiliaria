package com.inmobiliaria.listing.application;

import static com.inmobiliaria.listing.support.PropertyMother.T0;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.application.command.AddFavoriteCommand;
import com.inmobiliaria.listing.application.command.AddFavoriteHandler;
import com.inmobiliaria.listing.application.command.RemoveFavoriteCommand;
import com.inmobiliaria.listing.application.command.RemoveFavoriteHandler;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.application.exception.FavoriteNotFoundException;
import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.support.FixedClock;
import com.inmobiliaria.listing.support.InMemoryFavoriteRepository;
import com.inmobiliaria.listing.support.InMemoryPropertyRepository;
import com.inmobiliaria.listing.support.PropertyMother;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FavoriteHandlersTest {

    private final InMemoryPropertyRepository properties = new InMemoryPropertyRepository();
    private final InMemoryFavoriteRepository favorites = new InMemoryFavoriteRepository();
    private final AddFavoriteHandler add = new AddFavoriteHandler(properties, favorites, new FixedClock(T0));
    private final RemoveFavoriteHandler remove = new RemoveFavoriteHandler(favorites);
    private final UUID client = UUID.randomUUID();

    private Property stored(PropertyStatus status) {
        Property property = PropertyMother.inStatus(status);
        properties.save(property);
        return property;
    }

    @Test
    void should_save_a_published_property() {
        Property property = stored(PropertyStatus.PUBLISHED);

        add.handle(new AddFavoriteCommand(client, property.id()));

        assertThat(favorites.exists(client, property.id())).isTrue();
    }

    @Test
    void should_not_save_the_same_property_twice() {
        Property property = stored(PropertyStatus.PUBLISHED);
        add.handle(new AddFavoriteCommand(client, property.id()));

        assertThatThrownBy(() -> add.handle(new AddFavoriteCommand(client, property.id())))
                .isInstanceOf(DomainException.class)
                .extracting("code").isEqualTo("FAVORITE_ALREADY_EXISTS");
    }

    @Test
    void should_reject_a_paused_property() {
        Property property = stored(PropertyStatus.PAUSED);

        assertThatThrownBy(() -> add.handle(new AddFavoriteCommand(client, property.id())))
                .isInstanceOf(DomainException.class);
    }

    @Test
    void should_reject_an_unknown_property() {
        assertThatThrownBy(() -> add.handle(new AddFavoriteCommand(client, PropertyId.newId())))
                .isInstanceOf(PropertyNotFoundException.class);
    }

    @Test
    void should_remove_in_any_state() {
        Property property = stored(PropertyStatus.PUBLISHED);
        add.handle(new AddFavoriteCommand(client, property.id()));

        remove.handle(new RemoveFavoriteCommand(client, property.id()));

        assertThat(favorites.favorites).isEmpty();
        assertThatThrownBy(() -> remove.handle(new RemoveFavoriteCommand(client, property.id())))
                .isInstanceOf(FavoriteNotFoundException.class);
    }
}
