package com.inmobiliaria.listing.application;

import static com.inmobiliaria.listing.support.PropertyMother.AGENT;
import static com.inmobiliaria.listing.support.PropertyMother.T0;
import static org.assertj.core.api.Assertions.assertThat;

import com.inmobiliaria.listing.application.command.PropertyCommandSupport;
import com.inmobiliaria.listing.application.command.ReservePropertyHandler;
import com.inmobiliaria.listing.application.policy.LeadClosed;
import com.inmobiliaria.listing.application.policy.LeadClosed.Outcome;
import com.inmobiliaria.listing.application.policy.ReserveOnLeadWonPolicy;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.model.Actor;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.support.FakeCatalogProjection;
import com.inmobiliaria.listing.support.FakeEventPublisher;
import com.inmobiliaria.listing.support.FixedClock;
import com.inmobiliaria.listing.support.InMemoryProcessedEventStore;
import com.inmobiliaria.listing.support.InMemoryPropertyRepository;
import com.inmobiliaria.listing.support.PropertyMother;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Política ADR 0005, 3.1: caso feliz, rechazo por regla de estado (WARN, sin fallar) y duplicado. */
class ReserveOnLeadWonPolicyTest {

    private InMemoryPropertyRepository repository;
    private FakeCatalogProjection catalog;
    private FakeEventPublisher events;
    private InMemoryProcessedEventStore processed;
    private ReserveOnLeadWonPolicy policy;

    @BeforeEach
    void setUp() {
        repository = new InMemoryPropertyRepository();
        catalog = new FakeCatalogProjection();
        events = new FakeEventPublisher();
        processed = new InMemoryProcessedEventStore();
        PropertyCommandSupport support = new PropertyCommandSupport(repository, catalog, events, new FixedClock(T0));
        policy = new ReserveOnLeadWonPolicy(processed, repository, new ReservePropertyHandler(support));
    }

    private Property stored(PropertyStatus status) {
        Property property = PropertyMother.inStatus(status);
        repository.save(property);
        return property;
    }

    private static LeadClosed leadClosed(Property property, UUID agentId, Outcome outcome) {
        return new LeadClosed(UUID.randomUUID(), UUID.randomUUID(), property.id().value(), agentId,
                outcome, "corr-lead");
    }

    @Test
    void should_reserve_when_lead_is_won_and_property_is_published() {
        Property property = stored(PropertyStatus.PUBLISHED);
        LeadClosed event = leadClosed(property, AGENT, Outcome.WON);

        policy.handle(event);

        assertThat(repository.get(property.id()).status()).isEqualTo(PropertyStatus.RESERVED);
        assertThat(events.events).singleElement().isInstanceOfSatisfying(PropertyEvent.PropertyReserved.class,
                e -> assertThat(e.actor()).isEqualTo(Actor.SYSTEM));
        assertThat(events.metadata.getFirst().causationId()).isEqualTo(event.eventId());
        assertThat(events.metadata.getFirst().correlationId()).isEqualTo("corr-lead");
        assertThat(processed.processed).contains(event.eventId());
    }

    @Test
    void should_ignore_lost_leads_but_mark_them_processed() {
        Property property = stored(PropertyStatus.PUBLISHED);
        LeadClosed event = leadClosed(property, AGENT, Outcome.LOST);

        policy.handle(event);

        assertThat(repository.get(property.id()).status()).isEqualTo(PropertyStatus.PUBLISHED);
        assertThat(events.events).isEmpty();
        assertThat(processed.processed).contains(event.eventId());
    }

    @Test
    void should_not_reserve_and_not_fail_when_property_is_not_published() {
        Property property = stored(PropertyStatus.PAUSED);
        LeadClosed event = leadClosed(property, AGENT, Outcome.WON);

        policy.handle(event);

        assertThat(repository.get(property.id()).status()).isEqualTo(PropertyStatus.PAUSED);
        assertThat(events.events).isEmpty();
        assertThat(processed.processed).contains(event.eventId());
    }

    @Test
    void should_not_reserve_when_agent_does_not_match() {
        Property property = stored(PropertyStatus.PUBLISHED);

        policy.handle(leadClosed(property, UUID.randomUUID(), Outcome.WON));

        assertThat(repository.get(property.id()).status()).isEqualTo(PropertyStatus.PUBLISHED);
        assertThat(events.events).isEmpty();
    }

    @Test
    void should_process_a_duplicate_only_once() {
        Property property = stored(PropertyStatus.PUBLISHED);
        LeadClosed event = leadClosed(property, AGENT, Outcome.WON);

        policy.handle(event);
        policy.handle(event);

        assertThat(repository.get(property.id()).status()).isEqualTo(PropertyStatus.RESERVED);
        assertThat(events.events).hasSize(1);
    }

    @Test
    void should_not_fail_when_property_is_unknown() {
        LeadClosed event = new LeadClosed(UUID.randomUUID(), null, UUID.randomUUID(), AGENT,
                Outcome.WON, "corr");

        policy.handle(event);

        assertThat(events.events).isEmpty();
        assertThat(processed.processed).contains(event.eventId());
    }
}
