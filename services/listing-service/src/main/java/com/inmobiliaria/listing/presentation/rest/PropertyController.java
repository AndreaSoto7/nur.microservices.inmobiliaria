package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.MarkPropertyRentedCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.MarkPropertySoldCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.PausePropertyCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.PublishPropertyCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.ReleaseReservationCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusCommand.ReservePropertyCommand;
import com.inmobiliaria.listing.application.command.ChangePropertyStatusHandler;
import com.inmobiliaria.listing.application.command.PropertyCommandHandler;
import com.inmobiliaria.listing.application.command.PropertyCommands.CreatePropertyCommand;
import com.inmobiliaria.listing.application.command.PropertyCommands.EditPropertyCommand;
import com.inmobiliaria.listing.application.command.PropertyCommands.UpdatePropertyFeaturesCommand;
import com.inmobiliaria.listing.application.query.PropertyQueries.GetPropertyQuery;
import com.inmobiliaria.listing.application.query.PropertyQueries.ListAgentPropertiesQuery;
import com.inmobiliaria.listing.application.query.PropertyQueries.PropertySort;
import com.inmobiliaria.listing.application.query.PropertyQueryHandler;
import com.inmobiliaria.listing.application.query.PropertyViews.PageView;
import com.inmobiliaria.listing.application.query.PropertyViews.PropertyDetailView;
import com.inmobiliaria.listing.application.query.PropertyViews.PropertySummaryView;
import com.inmobiliaria.listing.domain.model.Actor;
import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.presentation.rest.PropertyRequests.CreatePropertyRequest;
import com.inmobiliaria.listing.presentation.rest.PropertyRequests.CreatedResponse;
import com.inmobiliaria.listing.presentation.rest.PropertyRequests.EditPropertyRequest;
import com.inmobiliaria.listing.presentation.rest.PropertyRequests.FeaturesRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import java.util.EnumSet;
import java.util.UUID;
import java.util.function.BiFunction;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Propiedades del agente. Solo traduce HTTP ↔ comandos y consultas: las reglas están en el dominio y
 * la verificación de dueño en la aplicación. El agentId es siempre el sub del JWT, nunca del body.
 */
@RestController
@RequestMapping("/api/v1/properties")
@PreAuthorize("hasRole('AGENT')")
public class PropertyController {

    private final PropertyCommandHandler commands;
    private final ChangePropertyStatusHandler transitions;
    private final PropertyQueryHandler queries;

    public PropertyController(PropertyCommandHandler commands, ChangePropertyStatusHandler transitions,
            PropertyQueryHandler queries) {
        this.commands = commands;
        this.transitions = transitions;
        this.queries = queries;
    }

    @PostMapping
    public ResponseEntity<CreatedResponse> create(@Valid @RequestBody CreatePropertyRequest body,
            @AuthenticationPrincipal Jwt jwt) {
        PropertyId id = commands.handle(new CreatePropertyCommand(agentId(jwt), body.title(), body.description(),
                body.propertyType(), body.operationType(), body.price().toDomain(), body.location().toDomain()));
        return ResponseEntity.created(URI.create("/api/v1/properties/" + id)).body(new CreatedResponse(id.toString()));
    }

    @GetMapping
    public PageView<PropertySummaryView> list(
            @RequestParam(required = false) PropertyStatus status,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "updatedAt,desc") String sort,
            @AuthenticationPrincipal Jwt jwt) {
        return queries.handle(new ListAgentPropertiesQuery(agentId(jwt), status, page, size, PropertySort.fromApi(sort)));
    }

    @GetMapping("/{propertyId}")
    public PropertyDetailView get(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return queries.handle(new GetPropertyQuery(propertyId, agentId(jwt)));
    }

    @PutMapping("/{propertyId}")
    public ResponseEntity<Void> edit(@PathVariable UUID propertyId, @Valid @RequestBody EditPropertyRequest body,
            @AuthenticationPrincipal Jwt jwt) {
        commands.handle(new EditPropertyCommand(new PropertyId(propertyId), agentId(jwt), body.title(),
                body.description(), body.price().toDomain(), body.location().toDomain()));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{propertyId}/features")
    public ResponseEntity<Void> updateFeatures(@PathVariable UUID propertyId, @Valid @RequestBody FeaturesRequest body,
            @AuthenticationPrincipal Jwt jwt) {
        EnumSet<Feature> features = body.features().isEmpty()
                ? EnumSet.noneOf(Feature.class)
                : EnumSet.copyOf(body.features());
        commands.handle(new UpdatePropertyFeaturesCommand(new PropertyId(propertyId), agentId(jwt), body.bedrooms(),
                body.bathrooms(), new Area(body.areaM2()), features));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{propertyId}/publish")
    public ResponseEntity<Void> publish(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt, PublishPropertyCommand::new);
    }

    @PostMapping("/{propertyId}/pause")
    public ResponseEntity<Void> pause(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt, PausePropertyCommand::new);
    }

    @PostMapping("/{propertyId}/reserve")
    public ResponseEntity<Void> reserve(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt, (id, agent) -> new ReservePropertyCommand(id, agent, Actor.AGENT));
    }

    @PostMapping("/{propertyId}/release-reservation")
    public ResponseEntity<Void> releaseReservation(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt, ReleaseReservationCommand::new);
    }

    @PostMapping("/{propertyId}/mark-sold")
    public ResponseEntity<Void> markSold(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt, MarkPropertySoldCommand::new);
    }

    @PostMapping("/{propertyId}/mark-rented")
    public ResponseEntity<Void> markRented(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt, MarkPropertyRentedCommand::new);
    }

    private ResponseEntity<Void> transition(UUID propertyId, Jwt jwt,
            BiFunction<PropertyId, UUID, ChangePropertyStatusCommand> command) {
        transitions.handle(command.apply(new PropertyId(propertyId), agentId(jwt)));
        return ResponseEntity.noContent().build();
    }

    static UUID agentId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
