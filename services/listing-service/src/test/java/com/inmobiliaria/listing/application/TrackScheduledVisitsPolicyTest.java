package com.inmobiliaria.listing.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.inmobiliaria.listing.application.policy.TrackScheduledVisitsPolicy;
import com.inmobiliaria.listing.application.policy.VisitScheduleChange;
import com.inmobiliaria.listing.application.policy.VisitScheduleChange.Kind;
import com.inmobiliaria.listing.support.InMemoryProcessedEventStore;
import com.inmobiliaria.listing.support.InMemoryScheduledVisits;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TrackScheduledVisitsPolicyTest {

    private static final UUID VISIT = UUID.randomUUID();
    private static final UUID PROPERTY = UUID.randomUUID();
    private static final Instant END = Instant.parse("2026-12-01T15:00:00Z");

    private final InMemoryScheduledVisits visits = new InMemoryScheduledVisits();
    private final TrackScheduledVisitsPolicy policy =
            new TrackScheduledVisitsPolicy(new InMemoryProcessedEventStore(), visits);

    private static VisitScheduleChange change(Kind kind, UUID eventId) {
        return new VisitScheduleChange(eventId, kind, VISIT, PROPERTY, kind == Kind.SCHEDULED ? END : null, "corr");
    }

    @Test
    void should_keep_a_scheduled_visit_and_forget_it_when_it_ends() {
        policy.handle(change(Kind.SCHEDULED, UUID.randomUUID()));
        assertThat(visits.visits).containsEntry(VISIT, new InMemoryScheduledVisits.Visit(PROPERTY, END));

        policy.handle(change(Kind.ENDED, UUID.randomUUID()));
        assertThat(visits.visits).isEmpty();
    }

    @Test
    void should_ignore_a_repeated_event() {
        UUID eventId = UUID.randomUUID();
        policy.handle(change(Kind.SCHEDULED, eventId));
        visits.untrack(VISIT);

        policy.handle(change(Kind.SCHEDULED, eventId));

        assertThat(visits.visits).isEmpty();
    }
}
