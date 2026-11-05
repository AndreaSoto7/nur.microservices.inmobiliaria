package com.inmobiliaria.listing.support;

import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.application.port.EventPublisher;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.model.Property;
import java.util.ArrayList;
import java.util.List;

public class FakeEventPublisher implements EventPublisher {

    public final List<PropertyEvent> events = new ArrayList<>();
    public final List<CommandMetadata> metadata = new ArrayList<>();

    @Override
    public void publish(Property property, List<? extends PropertyEvent> published, CommandMetadata meta) {
        events.addAll(published);
        published.forEach(e -> metadata.add(meta));
    }
}
