package com.inmobiliaria.listing.application;

import static com.inmobiliaria.listing.support.PropertyMother.AGENT;
import static com.inmobiliaria.listing.support.PropertyMother.T0;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.application.command.AddPropertyImagesCommand;
import com.inmobiliaria.listing.application.command.AddPropertyImagesHandler;
import com.inmobiliaria.listing.application.command.CreatePropertyCommand;
import com.inmobiliaria.listing.application.command.CreatePropertyHandler;
import com.inmobiliaria.listing.application.command.EditPropertyCommand;
import com.inmobiliaria.listing.application.command.EditPropertyHandler;
import com.inmobiliaria.listing.application.command.MarkPropertySoldCommand;
import com.inmobiliaria.listing.application.command.MarkPropertySoldHandler;
import com.inmobiliaria.listing.application.command.PausePropertyCommand;
import com.inmobiliaria.listing.application.command.PausePropertyHandler;
import com.inmobiliaria.listing.application.command.PropertyCommandSupport;
import com.inmobiliaria.listing.application.command.PublishPropertyCommand;
import com.inmobiliaria.listing.application.command.PublishPropertyHandler;
import com.inmobiliaria.listing.application.command.MovePropertyImageCommand;
import com.inmobiliaria.listing.application.command.MovePropertyImageHandler;
import com.inmobiliaria.listing.application.command.RemovePropertyImageCommand;
import com.inmobiliaria.listing.application.command.RemovePropertyImageHandler;
import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.application.port.ImageStorage;
import com.inmobiliaria.listing.application.exception.NotPropertyOwnerException;
import com.inmobiliaria.listing.application.exception.PropertyImageNotFoundException;
import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Money;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyImage;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.domain.model.PropertyType;
import com.inmobiliaria.listing.support.FakeCatalogProjection;
import com.inmobiliaria.listing.support.FakeEventPublisher;
import com.inmobiliaria.listing.support.FixedClock;
import com.inmobiliaria.listing.support.InMemoryPropertyRepository;
import com.inmobiliaria.listing.support.InMemoryScheduledVisits;
import com.inmobiliaria.listing.support.PropertyMother;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PropertyCommandHandlersTest {

    private InMemoryPropertyRepository repository;
    private FakeCatalogProjection catalog;
    private FakeEventPublisher events;
    private final InMemoryScheduledVisits scheduledVisits = new InMemoryScheduledVisits();
    private PropertyCommandSupport support;
    private final CommandMetadata owner = CommandMetadata.agent(AGENT, "corr-1");

    @BeforeEach
    void setUp() {
        repository = new InMemoryPropertyRepository();
        catalog = new FakeCatalogProjection();
        events = new FakeEventPublisher();
        support = new PropertyCommandSupport(repository, catalog, events, new FixedClock(T0));
    }

    private Property stored(PropertyStatus status) {
        Property property = PropertyMother.inStatus(status);
        repository.save(property);
        catalog.sync(property);
        return property;
    }

    @Test
    void create_should_store_a_draft_owned_by_the_agent_and_out_of_the_catalog() {
        PropertyId id = new CreatePropertyHandler(support).handle(new CreatePropertyCommand("Depto céntrico", "",
                PropertyType.APARTMENT, OperationType.RENT, Money.bob(new BigDecimal("3500")),
                Location.ofZone("Centro"), owner));

        assertThat(repository.get(id).status()).isEqualTo(PropertyStatus.DRAFT);
        assertThat(repository.get(id).agentId()).isEqualTo(AGENT);
        assertThat(catalog.rows).isEmpty();
    }

    @Test
    void publish_should_add_to_catalog_and_emit_status_change() {
        Property property = stored(PropertyStatus.DRAFT);

        new PublishPropertyHandler(support).handle(new PublishPropertyCommand(property.id(), owner));

        assertThat(repository.get(property.id()).status()).isEqualTo(PropertyStatus.PUBLISHED);
        assertThat(catalog.rows).containsKey(property.id());
        assertThat(events.events).singleElement().isInstanceOfSatisfying(PropertyEvent.PropertyPublished.class,
                e -> assertThat(e.previousStatus()).isEqualTo(PropertyStatus.DRAFT));
        assertThat(events.metadata.getFirst().correlationId()).isEqualTo("corr-1");
    }

    @Test
    void pause_should_remove_from_catalog() {
        Property property = stored(PropertyStatus.PUBLISHED);

        new PausePropertyHandler(support, scheduledVisits).handle(new PausePropertyCommand(property.id(), owner));

        assertThat(catalog.rows).doesNotContainKey(property.id());
    }

    @Test
    void sold_should_remove_from_catalog() {
        Property property = stored(PropertyStatus.RESERVED);

        new MarkPropertySoldHandler(support).handle(new MarkPropertySoldCommand(property.id(), owner));

        assertThat(repository.get(property.id()).status()).isEqualTo(PropertyStatus.SOLD);
        assertThat(catalog.rows).isEmpty();
    }

    @Test
    void edit_should_update_catalog_row_when_listed() {
        Property property = stored(PropertyStatus.PUBLISHED);

        new EditPropertyHandler(support).handle(new EditPropertyCommand(property.id(), "Rebajada", "",
                Money.bob(new BigDecimal("999999")), Location.ofZone("Equipetrol"), owner));

        assertThat(repository.get(property.id()).price()).isEqualTo(Money.bob(new BigDecimal("999999")));
        assertThat(catalog.rows).containsKey(property.id());
        assertThat(events.events).singleElement().isInstanceOf(PropertyEvent.PropertyUpdated.class);
    }

    @Test
    void should_reject_a_command_from_another_agent() {
        Property property = stored(PropertyStatus.PUBLISHED);
        CommandMetadata stranger = CommandMetadata.agent(UUID.randomUUID(), "corr-2");

        assertThatThrownBy(() -> new PausePropertyHandler(support, scheduledVisits)
                .handle(new PausePropertyCommand(property.id(), stranger)))
                .isInstanceOf(NotPropertyOwnerException.class);
        assertThat(repository.get(property.id()).status()).isEqualTo(PropertyStatus.PUBLISHED);
        assertThat(events.events).isEmpty();
    }

    @Test
    void should_fail_when_property_does_not_exist() {
        assertThatThrownBy(() -> new PublishPropertyHandler(support)
                .handle(new PublishPropertyCommand(PropertyId.newId(), owner)))
                .isInstanceOf(PropertyNotFoundException.class);
    }

    @Test
    void add_images_should_store_files_with_uuid_names_and_validate_real_type() {
        Property property = stored(PropertyStatus.DRAFT);
        MemoryStorage storage = new MemoryStorage();
        byte[] png = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};

        List<UUID> ids = new AddPropertyImagesHandler(support, storage)
                .handle(new AddPropertyImagesCommand(property.id(), List.of(png), owner));

        assertThat(ids).hasSize(1);
        assertThat(storage.files).containsOnlyKeys(property.id() + "/" + ids.getFirst() + ".png");
        assertThat(repository.get(property.id()).images()).hasSize(2);
    }

    @Test
    void add_images_should_reject_a_file_that_only_claims_to_be_an_image() {
        Property property = stored(PropertyStatus.DRAFT);
        MemoryStorage storage = new MemoryStorage();
        byte[] notAnImage = "<script>alert(1)</script>".getBytes();

        assertThatThrownBy(() -> new AddPropertyImagesHandler(support, storage)
                .handle(new AddPropertyImagesCommand(property.id(), List.of(notAnImage), owner)))
                .isInstanceOf(InvalidValueException.class);
        assertThat(storage.files).isEmpty();
    }

    @Test
    void pause_should_be_rejected_while_a_confirmed_visit_has_not_ended() {
        Property property = stored(PropertyStatus.PUBLISHED);
        scheduledVisits.track(UUID.randomUUID(), property.id().value(), T0.plusSeconds(3600));

        assertThatThrownBy(() -> new PausePropertyHandler(support, scheduledVisits)
                .handle(new PausePropertyCommand(property.id(), owner)))
                .isInstanceOf(DomainException.class)
                .hasFieldOrPropertyWithValue("code", "PROPERTY_HAS_SCHEDULED_VISITS");
        assertThat(repository.get(property.id()).status()).isEqualTo(PropertyStatus.PUBLISHED);
    }

    @Test
    void pause_should_ignore_a_confirmed_visit_that_already_ended() {
        Property property = stored(PropertyStatus.PUBLISHED);
        scheduledVisits.track(UUID.randomUUID(), property.id().value(), T0.minusSeconds(60));

        new PausePropertyHandler(support, scheduledVisits).handle(new PausePropertyCommand(property.id(), owner));

        assertThat(repository.get(property.id()).status()).isEqualTo(PropertyStatus.PAUSED);
    }

    @Test
    void remove_image_should_delete_the_file_and_resync_the_catalog_cover() {
        Property property = stored(PropertyStatus.PUBLISHED);
        PropertyImage cover = property.images().getFirst();
        PropertyImage second = PropertyMother.jpeg(property);
        property.addImage(second, T0);
        property.pullEvents();
        repository.save(property);
        MemoryStorage storage = new MemoryStorage();
        storage.store(cover.storageKey(), new byte[] {1});

        new RemovePropertyImageHandler(support, storage)
                .handle(new RemovePropertyImageCommand(property.id(), cover.id(), owner));

        assertThat(repository.get(property.id()).images()).containsExactly(second);
        assertThat(storage.files).doesNotContainKey(cover.storageKey());
        assertThat(events.events).singleElement().isInstanceOf(PropertyEvent.PropertyImageRemoved.class);
    }

    @Test
    void move_image_should_change_the_cover_and_resync_the_catalog() {
        Property property = stored(PropertyStatus.PUBLISHED);
        PropertyImage cover = property.images().getFirst();
        PropertyImage second = PropertyMother.jpeg(property);
        property.addImage(second, T0);
        property.pullEvents();
        repository.save(property);

        new MovePropertyImageHandler(support)
                .handle(new MovePropertyImageCommand(property.id(), second.id(), 0, owner));

        assertThat(repository.get(property.id()).images()).containsExactly(second, cover);
        assertThat(events.events).singleElement().isInstanceOf(PropertyEvent.PropertyImagesReordered.class);
    }

    @Test
    void move_image_should_answer_not_found_for_an_unknown_image() {
        Property property = stored(PropertyStatus.DRAFT);

        assertThatThrownBy(() -> new MovePropertyImageHandler(support)
                .handle(new MovePropertyImageCommand(property.id(), UUID.randomUUID(), 0, owner)))
                .isInstanceOf(PropertyImageNotFoundException.class);
    }

    @Test
    void remove_image_should_answer_not_found_for_an_unknown_image() {
        Property property = stored(PropertyStatus.DRAFT);

        assertThatThrownBy(() -> new RemovePropertyImageHandler(support, new MemoryStorage())
                .handle(new RemovePropertyImageCommand(property.id(), UUID.randomUUID(), owner)))
                .isInstanceOf(PropertyImageNotFoundException.class);
    }

    @Test
    void remove_image_should_only_let_the_owner_do_it() {
        Property property = stored(PropertyStatus.DRAFT);
        CommandMetadata stranger = CommandMetadata.agent(UUID.randomUUID(), "corr-2");

        assertThatThrownBy(() -> new RemovePropertyImageHandler(support, new MemoryStorage())
                .handle(new RemovePropertyImageCommand(property.id(), property.images().getFirst().id(), stranger)))
                .isInstanceOf(NotPropertyOwnerException.class);
    }

    static class MemoryStorage implements ImageStorage {

        final Map<String, byte[]> files = new HashMap<>();

        @Override
        public void store(String storageKey, byte[] content) {
            files.put(storageKey, content);
        }

        @Override
        public Optional<byte[]> load(String storageKey) {
            return Optional.ofNullable(files.get(storageKey));
        }

        @Override
        public void delete(String storageKey) {
            files.remove(storageKey);
        }
    }
}
