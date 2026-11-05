package com.inmobiliaria.listing.application;

import static com.inmobiliaria.listing.support.InMemoryAdapters.gif;
import static com.inmobiliaria.listing.support.InMemoryAdapters.jpeg;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.inmobiliaria.listing.application.command.AddPropertyImageHandler;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.MarkPropertyRentedCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.PausePropertyCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.PublishPropertyCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.ReservePropertyCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusHandler;
import com.inmobiliaria.listing.application.command.PropertyCommandHandler;
import com.inmobiliaria.listing.application.command.PropertyCommands.AddPropertyImageCommand;
import com.inmobiliaria.listing.application.command.PropertyCommands.CreatePropertyCommand;
import com.inmobiliaria.listing.application.command.PropertyCommands.EditPropertyCommand;
import com.inmobiliaria.listing.application.command.PropertyCommands.UpdatePropertyFeaturesCommand;
import com.inmobiliaria.listing.application.exception.PropertyNotFoundException;
import com.inmobiliaria.listing.application.query.PropertyQueries.GetPropertyImageQuery;
import com.inmobiliaria.listing.application.query.PropertyQueryHandler;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.exception.InvalidStateTransitionException;
import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import com.inmobiliaria.listing.domain.model.Actor;
import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Money;
import com.inmobiliaria.listing.domain.model.OperationType;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.domain.model.PropertyType;
import com.inmobiliaria.listing.support.InMemoryAdapters.InMemoryImageStorage;
import com.inmobiliaria.listing.support.InMemoryAdapters.InMemoryPropertyRepository;
import com.inmobiliaria.listing.support.InMemoryAdapters.RecordingEventPublisher;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PropertyHandlersTest {

    private static final UUID AGENT = UUID.fromString("8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d");
    private static final UUID OTHER_AGENT = UUID.fromString("1f2e3d4c-5b6a-4978-8695-a4b3c2d1e0f9");
    private static final Instant NOW = Instant.parse("2026-11-05T12:00:00Z");

    private InMemoryPropertyRepository repository;
    private RecordingEventPublisher events;
    private InMemoryImageStorage storage;
    private PropertyCommandHandler commands;
    private ChangePropertyStatusHandler transitions;
    private AddPropertyImageHandler images;
    private PropertyQueryHandler queries;

    @BeforeEach
    void setUp() {
        repository = new InMemoryPropertyRepository();
        events = new RecordingEventPublisher();
        storage = new InMemoryImageStorage();
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        commands = new PropertyCommandHandler(repository, events, clock);
        transitions = new ChangePropertyStatusHandler(repository, events, clock);
        images = new AddPropertyImageHandler(repository, storage, events, clock);
        queries = new PropertyQueryHandler(null, repository, storage);
    }

    @Test
    void should_create_a_draft_owned_by_the_agent() {
        PropertyId id = create(OperationType.SALE);

        var saved = repository.findById(id).orElseThrow();
        assertThat(saved.status()).isEqualTo(PropertyStatus.DRAFT);
        assertThat(saved.isOwnedBy(AGENT)).isTrue();
        assertThat(events.last()).isInstanceOf(PropertyEvent.PropertyCreated.class);
    }

    @Test
    void should_publish_after_features_and_an_image() {
        PropertyId id = readyToPublish(OperationType.SALE);

        transitions.handle(new PublishPropertyCommand(id, AGENT));

        assertThat(repository.findById(id).orElseThrow().status()).isEqualTo(PropertyStatus.PUBLISHED);
        assertThat(events.last()).isEqualTo(new PropertyEvent.PropertyPublished(id, PropertyStatus.DRAFT, NOW));
    }

    @Test
    void should_record_agent_as_actor_when_the_agent_reserves() {
        PropertyId id = published(OperationType.SALE);

        transitions.handle(new ReservePropertyCommand(id, AGENT, Actor.AGENT));

        assertThat(events.last()).isEqualTo(new PropertyEvent.PropertyReserved(id, Actor.AGENT, NOW));
    }

    @Test
    void should_let_the_lead_closed_policy_reserve_as_system_with_the_same_command() {
        PropertyId id = published(OperationType.SALE);

        transitions.handle(new ReservePropertyCommand(id, AGENT, Actor.SYSTEM));

        assertThat(events.last()).isEqualTo(new PropertyEvent.PropertyReserved(id, Actor.SYSTEM, NOW));
    }

    @Test
    void should_not_let_the_system_reserve_a_property_of_another_agent() {
        PropertyId id = published(OperationType.SALE);

        assertThatThrownBy(() -> transitions.handle(new ReservePropertyCommand(id, OTHER_AGENT, Actor.SYSTEM)))
                .isInstanceOf(PropertyNotFoundException.class);
        assertThat(repository.findById(id).orElseThrow().status()).isEqualTo(PropertyStatus.PUBLISHED);
    }

    @Test
    void should_announce_a_new_image_of_a_published_property() {
        PropertyId id = published(OperationType.SALE);

        images.handle(new AddPropertyImageCommand(id, AGENT, jpeg()));

        assertThat(events.last()).isEqualTo(new PropertyEvent.PropertyUpdated(id, NOW));
    }

    @Test
    void should_hide_a_property_of_another_agent() {
        PropertyId id = create(OperationType.SALE);
        int savesBefore = repository.saves;
        int eventsBefore = events.published.size();

        assertThatThrownBy(() -> commands.handle(new EditPropertyCommand(id, OTHER_AGENT, "Otro título", "",
                price(), Location.ofZone("Norte")))).isInstanceOf(PropertyNotFoundException.class);
        assertThatThrownBy(() -> transitions.handle(new PausePropertyCommand(id, OTHER_AGENT)))
                .isInstanceOf(PropertyNotFoundException.class);

        assertThat(repository.saves).isEqualTo(savesBefore);
        assertThat(events.published).hasSize(eventsBefore);
    }

    @Test
    void should_not_save_nor_publish_when_the_aggregate_rejects_the_transition() {
        PropertyId id = create(OperationType.SALE);
        int savesBefore = repository.saves;
        int eventsBefore = events.published.size();

        assertThatThrownBy(() -> transitions.handle(new PausePropertyCommand(id, AGENT)))
                .isInstanceOf(InvalidStateTransitionException.class);
        assertThatThrownBy(() -> transitions.handle(new MarkPropertyRentedCommand(id, AGENT)))
                .isInstanceOf(DomainException.class);

        assertThat(repository.saves).isEqualTo(savesBefore);
        assertThat(events.published).hasSize(eventsBefore);
    }

    @Test
    void should_detect_image_type_from_content_and_reject_other_formats() {
        PropertyId id = create(OperationType.SALE);

        assertThatThrownBy(() -> images.handle(new AddPropertyImageCommand(id, AGENT, gif())))
                .isInstanceOf(InvalidValueException.class)
                .hasFieldOrPropertyWithValue("code", "PROPERTY_IMAGE_INVALID_TYPE");
        assertThat(storage.files).isEmpty();

        UUID imageId = images.handle(new AddPropertyImageCommand(id, AGENT, jpeg()));

        var image = repository.findById(id).orElseThrow().images().getFirst();
        assertThat(image.id()).isEqualTo(imageId);
        assertThat(image.contentType()).isEqualTo("image/jpeg");
        assertThat(image.storageKey()).isEqualTo("properties/" + id + "/" + imageId);
        assertThat(storage.files).containsKey(image.storageKey());
    }

    @Test
    void should_show_draft_images_only_to_the_owner() {
        PropertyId id = create(OperationType.SALE);
        UUID imageId = images.handle(new AddPropertyImageCommand(id, AGENT, jpeg()));

        assertThatThrownBy(() -> queries.handle(new GetPropertyImageQuery(id.value(), imageId, null)))
                .isInstanceOf(PropertyNotFoundException.class);
        assertThatThrownBy(() -> queries.handle(new GetPropertyImageQuery(id.value(), imageId, OTHER_AGENT)))
                .isInstanceOf(PropertyNotFoundException.class);
        assertThat(queries.handle(new GetPropertyImageQuery(id.value(), imageId, AGENT)).contentType())
                .isEqualTo("image/jpeg");
    }

    @Test
    void should_show_images_of_a_published_property_to_anyone() {
        PropertyId id = readyToPublish(OperationType.RENT);
        transitions.handle(new PublishPropertyCommand(id, AGENT));
        UUID imageId = repository.findById(id).orElseThrow().images().getFirst().id();

        assertThat(queries.handle(new GetPropertyImageQuery(id.value(), imageId, null)).content()).isEqualTo(jpeg());
    }

    private PropertyId create(OperationType operation) {
        return commands.handle(new CreatePropertyCommand(AGENT, "Casa con jardín", "Dos plantas", PropertyType.HOUSE,
                operation, price(), Location.ofZone("Equipetrol")));
    }

    private PropertyId readyToPublish(OperationType operation) {
        PropertyId id = create(operation);
        commands.handle(new UpdatePropertyFeaturesCommand(id, AGENT, 3, 2, new Area(new BigDecimal("240.5")),
                Set.of(Feature.GARAGE)));
        images.handle(new AddPropertyImageCommand(id, AGENT, jpeg()));
        return id;
    }

    private PropertyId published(OperationType operation) {
        PropertyId id = readyToPublish(operation);
        transitions.handle(new PublishPropertyCommand(id, AGENT));
        return id;
    }

    private static Money price() {
        return Money.bob(new BigDecimal("1285000"));
    }
}
