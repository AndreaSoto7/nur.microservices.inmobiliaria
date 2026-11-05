package com.inmobiliaria.listing.domain.model;

import static com.inmobiliaria.listing.domain.model.PropertyStatus.DRAFT;
import static com.inmobiliaria.listing.domain.model.PropertyStatus.PAUSED;
import static com.inmobiliaria.listing.domain.model.PropertyStatus.PUBLISHED;
import static com.inmobiliaria.listing.domain.model.PropertyStatus.RENTED;
import static com.inmobiliaria.listing.domain.model.PropertyStatus.RESERVED;
import static com.inmobiliaria.listing.domain.model.PropertyStatus.SOLD;

import com.inmobiliaria.listing.domain.event.PropertyEvent;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import com.inmobiliaria.listing.domain.exception.InvalidStateTransitionException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Aggregate raíz del ciclo de vida de una propiedad. Toda regla de estado vive aquí (sin setters):
 * cada método valida la transición de la tabla de services/listing-service/CLAUDE.md y registra el
 * evento de dominio. Los permisos de usuario ("solo el agente dueño") los revisa la capa de
 * aplicación con {@link #isOwnedBy(UUID)}.
 */
public class Property {

    public static final int MAX_IMAGES = 5;
    private static final int MAX_TITLE = 150;
    private static final int MAX_DESCRIPTION = 5000;

    private final PropertyId id;
    private final UUID agentId;
    private final PropertyType type;
    private final OperationType operation;
    private final Instant createdAt;
    private String title;
    private String description;
    private Money price;
    private Location location;
    private Integer bedrooms;
    private Integer bathrooms;
    private Area area;
    private final Set<Feature> features = EnumSet.noneOf(Feature.class);
    private final List<PropertyImage> images = new ArrayList<>();
    private PropertyStatus status;
    private Instant publishedAt;
    private Instant updatedAt;
    private final List<PropertyEvent> pendingEvents = new ArrayList<>();

    private Property(PropertyId id, UUID agentId, PropertyType type, OperationType operation, Instant createdAt) {
        this.id = Objects.requireNonNull(id, "id");
        this.agentId = Objects.requireNonNull(agentId, "agentId");
        this.type = Objects.requireNonNull(type, "type");
        this.operation = Objects.requireNonNull(operation, "operation");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt");
        this.updatedAt = createdAt;
    }

    /** Factory: una propiedad nace en DRAFT con tipo, operación, precio y zona válidos. */
    public static Property create(UUID agentId, String title, String description, PropertyType type,
            OperationType operation, Money price, Location location, Instant now) {
        Property property = new Property(PropertyId.newId(), agentId, type, operation, now);
        property.title = validTitle(title);
        property.description = validDescription(description);
        property.price = Objects.requireNonNull(price, "price");
        property.location = Objects.requireNonNull(location, "location");
        property.status = DRAFT;
        property.pendingEvents.add(new PropertyEvent.PropertyCreated(property.id, now));
        return property;
    }

    // ─── Edición ─────────────────────────────────────────────────────────────

    public void edit(String title, String description, Money price, Location location, Instant now) {
        requireNotClosed("editar");
        this.title = validTitle(title);
        this.description = validDescription(description);
        this.price = Objects.requireNonNull(price, "price");
        this.location = Objects.requireNonNull(location, "location");
        touched(now);
    }

    public void updateFeatures(int bedrooms, int bathrooms, Area area, Set<Feature> features, Instant now) {
        requireNotClosed("cambiar las características de");
        if (bedrooms < 0 || bathrooms < 0) {
            throw new InvalidValueException("PROPERTY_INVALID_FEATURES", "Dormitorios y baños no pueden ser negativos");
        }
        this.bedrooms = bedrooms;
        this.bathrooms = bathrooms;
        this.area = Objects.requireNonNull(area, "area");
        this.features.clear();
        this.features.addAll(Objects.requireNonNull(features, "features"));
        touched(now);
    }

    public void addImage(PropertyImage image, Instant now) {
        requireNotClosed("agregar imágenes a");
        if (images.size() >= MAX_IMAGES) {
            throw new DomainException("PROPERTY_IMAGE_LIMIT", "Una propiedad tiene como máximo " + MAX_IMAGES + " imágenes");
        }
        images.add(Objects.requireNonNull(image, "image"));
        updatedAt = now;
        pendingEvents.add(new PropertyEvent.PropertyImagesAdded(id, now));
    }

    // ─── Máquina de estados ──────────────────────────────────────────────────

    /** DRAFT → PUBLISHED (nueva) o PAUSED → PUBLISHED (reanudada). Exige datos completos y 1 foto. */
    public void publish(Instant now) {
        PropertyStatus previous = requireStatus("publicar", DRAFT, PAUSED);
        if (bedrooms == null || bathrooms == null || area == null) {
            throw new DomainException("PROPERTY_INCOMPLETE",
                    "Completa dormitorios, baños y superficie antes de publicar");
        }
        if (images.isEmpty()) {
            throw new DomainException("PROPERTY_WITHOUT_IMAGES", "Agrega al menos una imagen antes de publicar");
        }
        if (publishedAt == null) {
            publishedAt = now;
        }
        moveTo(PUBLISHED, now);
        pendingEvents.add(new PropertyEvent.PropertyPublished(id, previous, now));
    }

    public void pause(Instant now) {
        requireStatus("pausar", PUBLISHED);
        moveTo(PAUSED, now);
        pendingEvents.add(new PropertyEvent.PropertyPaused(id, now));
    }

    /** La invoca el agente o la política LeadClosed (actor SYSTEM): las reglas de estado son las mismas. */
    public void reserve(Actor actor, Instant now) {
        requireStatus("reservar", PUBLISHED);
        moveTo(RESERVED, now);
        pendingEvents.add(new PropertyEvent.PropertyReserved(id, Objects.requireNonNull(actor, "actor"), now));
    }

    public void releaseReservation(Instant now) {
        requireStatus("liberar la reserva de", RESERVED);
        moveTo(PUBLISHED, now);
        pendingEvents.add(new PropertyEvent.PropertyPublished(id, RESERVED, now));
    }

    public void markSold(Instant now) {
        requireStatus("marcar como vendida", PUBLISHED, RESERVED);
        requireOperation(OperationType.SALE, "vender");
        moveTo(SOLD, now);
        pendingEvents.add(new PropertyEvent.PropertySold(id, now));
    }

    public void markRented(Instant now) {
        requireStatus("marcar como alquilada", PUBLISHED, RESERVED);
        requireOperation(OperationType.RENT, "alquilar");
        moveTo(RENTED, now);
        pendingEvents.add(new PropertyEvent.PropertyRented(id, now));
    }

    // ─── Consultas sobre el aggregate ────────────────────────────────────────

    public boolean isOwnedBy(UUID userId) {
        return agentId.equals(userId);
    }

    /** Devuelve los eventos registrados desde la última vez y los olvida (se despachan tras guardar). */
    public List<PropertyEvent> pullEvents() {
        List<PropertyEvent> events = List.copyOf(pendingEvents);
        pendingEvents.clear();
        return events;
    }

    public PropertyId id() { return id; }
    public UUID agentId() { return agentId; }
    public PropertyType type() { return type; }
    public OperationType operation() { return operation; }
    public String title() { return title; }
    public String description() { return description; }
    public Money price() { return price; }
    public Location location() { return location; }
    public Optional<Integer> bedrooms() { return Optional.ofNullable(bedrooms); }
    public Optional<Integer> bathrooms() { return Optional.ofNullable(bathrooms); }
    public Optional<Area> area() { return Optional.ofNullable(area); }
    public Set<Feature> features() { return Collections.unmodifiableSet(features); }
    public List<PropertyImage> images() { return Collections.unmodifiableList(images); }
    public PropertyStatus status() { return status; }
    public Optional<Instant> publishedAt() { return Optional.ofNullable(publishedAt); }
    public Instant createdAt() { return createdAt; }
    public Instant updatedAt() { return updatedAt; }

    // ─── Reglas internas ─────────────────────────────────────────────────────

    private PropertyStatus requireStatus(String action, PropertyStatus... allowed) {
        for (PropertyStatus candidate : allowed) {
            if (status == candidate) {
                return status;
            }
        }
        throw new InvalidStateTransitionException(
                "No se puede " + action + " una propiedad en estado " + status);
    }

    private void requireNotClosed(String action) {
        if (status.isClosed()) {
            throw new InvalidStateTransitionException(
                    "No se puede " + action + " una propiedad en estado " + status);
        }
    }

    private void requireOperation(OperationType expected, String verb) {
        if (operation != expected) {
            throw new DomainException("PROPERTY_OPERATION_MISMATCH",
                    "Solo se puede " + verb + " una propiedad publicada para " + expected);
        }
    }

    private void moveTo(PropertyStatus target, Instant now) {
        status = target;
        updatedAt = now;
    }

    /** Los cambios de una propiedad visible se avisan a visit y al catálogo con PropertyUpdated. */
    private void touched(Instant now) {
        updatedAt = now;
        if (status.isListed()) {
            pendingEvents.add(new PropertyEvent.PropertyUpdated(id, now));
        }
    }

    private static String validTitle(String title) {
        String value = title == null ? "" : title.strip();
        if (value.isEmpty() || value.length() > MAX_TITLE) {
            throw new InvalidValueException("PROPERTY_INVALID_TITLE",
                    "El título es obligatorio y tiene como máximo " + MAX_TITLE + " caracteres");
        }
        return value;
    }

    private static String validDescription(String description) {
        String value = description == null ? "" : description.strip();
        if (value.length() > MAX_DESCRIPTION) {
            throw new InvalidValueException("PROPERTY_INVALID_DESCRIPTION",
                    "La descripción tiene como máximo " + MAX_DESCRIPTION + " caracteres");
        }
        return value;
    }
}
