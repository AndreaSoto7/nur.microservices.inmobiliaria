package com.inmobiliaria.listing.support;

import com.inmobiliaria.listing.application.port.EventPublisher;
import com.inmobiliaria.listing.application.port.ImageStorage;
import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Dobles de los puertos para los tests de aplicación (rule testing): sin base, sin disco, sin Kafka. */
public final class InMemoryAdapters {

    private InMemoryAdapters() {}

    public static class InMemoryPropertyRepository implements PropertyRepository {

        private final Map<PropertyId, Property> store = new HashMap<>();
        public int saves;

        @Override
        public Optional<Property> findById(PropertyId id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public void save(Property property) {
            saves++;
            store.put(property.id(), property);
        }
    }

    public static class RecordingEventPublisher implements EventPublisher {

        public final List<PropertyEvent> published = new ArrayList<>();

        @Override
        public void publish(Property source, List<? extends PropertyEvent> domainEvents) {
            published.addAll(domainEvents);
        }

        public PropertyEvent last() {
            return published.getLast();
        }
    }

    public static class InMemoryImageStorage implements ImageStorage {

        public final Map<String, byte[]> files = new HashMap<>();

        @Override
        public void store(String key, byte[] content) {
            files.put(key, content);
        }

        @Override
        public Optional<byte[]> load(String key) {
            return Optional.ofNullable(files.get(key));
        }

        @Override
        public void delete(String key) {
            files.remove(key);
        }
    }

    /** Los primeros bytes de un JPG real: suficiente para la detección por contenido. */
    public static byte[] jpeg() {
        return new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F'};
    }

    public static byte[] gif() {
        return new byte[] {'G', 'I', 'F', '8', '9', 'a', 1, 0, 1, 0};
    }
}
