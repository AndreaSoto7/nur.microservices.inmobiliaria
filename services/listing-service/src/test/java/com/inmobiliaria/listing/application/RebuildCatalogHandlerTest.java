package com.inmobiliaria.listing.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.inmobiliaria.listing.application.command.RebuildCatalogHandler;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.support.FakeCatalogProjection;
import com.inmobiliaria.listing.support.InMemoryPropertyRepository;
import com.inmobiliaria.listing.support.PropertyMother;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RebuildCatalogHandlerTest {

    private final InMemoryPropertyRepository repository = new InMemoryPropertyRepository();
    private final FakeCatalogProjection catalog = new FakeCatalogProjection();
    private final RebuildCatalogHandler handler = new RebuildCatalogHandler(repository, catalog);

    private Property stored(PropertyStatus status) {
        Property property = PropertyMother.inStatus(status);
        repository.save(property);
        return property;
    }

    @Test
    void should_list_only_published_and_reserved_properties_and_drop_stale_rows() {
        Property published = stored(PropertyStatus.PUBLISHED);
        Property reserved = stored(PropertyStatus.RESERVED);
        Property paused = stored(PropertyStatus.PAUSED);
        stored(PropertyStatus.DRAFT);
        catalog.rows.put(paused.id(), PropertyStatus.PUBLISHED);
        catalog.rows.put(PropertyId.newId(), PropertyStatus.PUBLISHED);

        int reviewed = handler.handle();

        assertThat(reviewed).isEqualTo(4);
        assertThat(catalog.rows).containsExactlyInAnyOrderEntriesOf(Map.of(
                published.id(), PropertyStatus.PUBLISHED,
                reserved.id(), PropertyStatus.RESERVED));
    }

    @Test
    void should_be_idempotent() {
        stored(PropertyStatus.PUBLISHED);

        handler.handle();
        Map<PropertyId, PropertyStatus> first = Map.copyOf(catalog.rows);
        handler.handle();

        assertThat(catalog.rows).isEqualTo(first);
    }
}
