package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.infrastructure.web.CorrelationIdFilter;
import com.inmobiliaria.listing.application.command.AddPropertyImagesCommand;
import com.inmobiliaria.listing.application.command.AddPropertyImagesHandler;
import com.inmobiliaria.listing.application.command.CreatePropertyCommand;
import com.inmobiliaria.listing.application.command.CreatePropertyHandler;
import com.inmobiliaria.listing.application.command.EditPropertyCommand;
import com.inmobiliaria.listing.application.command.EditPropertyHandler;
import com.inmobiliaria.listing.application.command.MarkPropertyRentedCommand;
import com.inmobiliaria.listing.application.command.MarkPropertyRentedHandler;
import com.inmobiliaria.listing.application.command.MarkPropertySoldCommand;
import com.inmobiliaria.listing.application.command.MarkPropertySoldHandler;
import com.inmobiliaria.listing.application.command.PausePropertyCommand;
import com.inmobiliaria.listing.application.command.PausePropertyHandler;
import com.inmobiliaria.listing.application.command.PublishPropertyCommand;
import com.inmobiliaria.listing.application.command.PublishPropertyHandler;
import com.inmobiliaria.listing.application.command.ReleaseReservationCommand;
import com.inmobiliaria.listing.application.command.ReleaseReservationHandler;
import com.inmobiliaria.listing.application.command.ReservePropertyCommand;
import com.inmobiliaria.listing.application.command.ReservePropertyHandler;
import com.inmobiliaria.listing.application.command.UpdatePropertyFeaturesCommand;
import com.inmobiliaria.listing.application.command.UpdatePropertyFeaturesHandler;
import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.application.query.GetPropertyByIdHandler;
import com.inmobiliaria.listing.application.query.GetPropertyByIdQuery;
import com.inmobiliaria.listing.application.query.ListAgentPropertiesHandler;
import com.inmobiliaria.listing.application.query.ListAgentPropertiesQuery;
import com.inmobiliaria.listing.application.query.PropertyReadModel;
import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.Location;
import com.inmobiliaria.listing.domain.model.Money;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import com.inmobiliaria.listing.presentation.rest.dto.CreatePropertyRequest;
import com.inmobiliaria.listing.presentation.rest.dto.EditPropertyRequest;
import com.inmobiliaria.listing.presentation.rest.dto.IdResponse;
import com.inmobiliaria.listing.presentation.rest.dto.ImagesAddedResponse;
import com.inmobiliaria.listing.presentation.rest.dto.LocationDto;
import com.inmobiliaria.listing.presentation.rest.dto.MoneyDto;
import com.inmobiliaria.listing.presentation.rest.dto.PageResponse;
import com.inmobiliaria.listing.presentation.rest.dto.PropertyDetailResponse;
import com.inmobiliaria.listing.presentation.rest.dto.PropertySummaryResponse;
import com.inmobiliaria.listing.presentation.rest.dto.UpdateFeaturesRequest;
import jakarta.validation.Valid;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import org.springframework.http.MediaType;
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
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Comandos y vistas del agente sobre sus propiedades. Solo rol AGENT; el dueño se verifica en aplicación. */
@RestController
@RequestMapping("/api/v1/properties")
@PreAuthorize("hasRole('AGENT')")
public class PropertyController {

    private final CreatePropertyHandler create;
    private final EditPropertyHandler edit;
    private final UpdatePropertyFeaturesHandler updateFeatures;
    private final AddPropertyImagesHandler addImages;
    private final PublishPropertyHandler publish;
    private final PausePropertyHandler pause;
    private final ReservePropertyHandler reserve;
    private final ReleaseReservationHandler releaseReservation;
    private final MarkPropertySoldHandler markSold;
    private final MarkPropertyRentedHandler markRented;
    private final ListAgentPropertiesHandler listMine;
    private final GetPropertyByIdHandler getById;

    public PropertyController(CreatePropertyHandler create, EditPropertyHandler edit,
            UpdatePropertyFeaturesHandler updateFeatures, AddPropertyImagesHandler addImages,
            PublishPropertyHandler publish, PausePropertyHandler pause, ReservePropertyHandler reserve,
            ReleaseReservationHandler releaseReservation, MarkPropertySoldHandler markSold,
            MarkPropertyRentedHandler markRented, ListAgentPropertiesHandler listMine,
            GetPropertyByIdHandler getById) {
        this.create = create;
        this.edit = edit;
        this.updateFeatures = updateFeatures;
        this.addImages = addImages;
        this.publish = publish;
        this.pause = pause;
        this.reserve = reserve;
        this.releaseReservation = releaseReservation;
        this.markSold = markSold;
        this.markRented = markRented;
        this.listMine = listMine;
        this.getById = getById;
    }

    @PostMapping
    public ResponseEntity<IdResponse> create(@Valid @RequestBody CreatePropertyRequest body,
            @AuthenticationPrincipal Jwt jwt) {
        PropertyId id = create.handle(new CreatePropertyCommand(body.title(), body.description(),
                body.propertyType(), body.operationType(), money(body.price()), location(body.location()),
                agent(jwt)));
        return ResponseEntity.created(URI.create("/api/v1/properties/" + id)).body(new IdResponse(id.value()));
    }

    @GetMapping
    public PageResponse<PropertySummaryResponse> listMine(@AuthenticationPrincipal Jwt jwt,
            @RequestParam Optional<PropertyStatus> status, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size, @RequestParam(required = false) List<String> sort) {
        var result = listMine.handle(new ListAgentPropertiesQuery(CurrentUser.id(jwt), status,
                PageParams.of(page, size, sort, PropertyReadModel.SORTABLE_FIELDS)));
        return PageResponse.of(result, PropertySummaryResponse::from);
    }

    @GetMapping("/{propertyId}")
    public PropertyDetailResponse get(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return PropertyDetailResponse.from(
                getById.handle(new GetPropertyByIdQuery(new PropertyId(propertyId), CurrentUser.id(jwt))));
    }

    @PutMapping("/{propertyId}")
    public ResponseEntity<Void> edit(@PathVariable UUID propertyId, @Valid @RequestBody EditPropertyRequest body,
            @AuthenticationPrincipal Jwt jwt) {
        edit.handle(new EditPropertyCommand(new PropertyId(propertyId), body.title(), body.description(),
                money(body.price()), location(body.location()), agent(jwt)));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{propertyId}/features")
    public ResponseEntity<Void> updateFeatures(@PathVariable UUID propertyId,
            @Valid @RequestBody UpdateFeaturesRequest body, @AuthenticationPrincipal Jwt jwt) {
        Set<Feature> features = EnumSet.noneOf(Feature.class);
        if (body.features() != null) {
            body.features().forEach(f -> features.add(Features.parse(f)));
        }
        updateFeatures.handle(new UpdatePropertyFeaturesCommand(new PropertyId(propertyId), body.bedrooms(),
                body.bathrooms(), new Area(body.areaM2()), features, agent(jwt)));
        return ResponseEntity.noContent().build();
    }

    @PostMapping(path = "/{propertyId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImagesAddedResponse> addImages(@PathVariable UUID propertyId,
            @RequestPart("files") List<MultipartFile> files, @AuthenticationPrincipal Jwt jwt) {
        List<byte[]> contents = new ArrayList<>();
        for (MultipartFile file : files) {
            try {
                contents.add(file.getBytes());
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        List<UUID> ids = addImages.handle(new AddPropertyImagesCommand(new PropertyId(propertyId), contents,
                agent(jwt)));
        return ResponseEntity.status(201).body(new ImagesAddedResponse(ids));
    }

    @PostMapping("/{propertyId}/publish")
    public ResponseEntity<Void> publish(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt, (id, meta) -> publish.handle(new PublishPropertyCommand(id, meta)));
    }

    @PostMapping("/{propertyId}/pause")
    public ResponseEntity<Void> pause(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt, (id, meta) -> pause.handle(new PausePropertyCommand(id, meta)));
    }

    @PostMapping("/{propertyId}/reserve")
    public ResponseEntity<Void> reserve(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt, (id, meta) -> reserve.handle(new ReservePropertyCommand(id, meta)));
    }

    @PostMapping("/{propertyId}/release-reservation")
    public ResponseEntity<Void> releaseReservation(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt,
                (id, meta) -> releaseReservation.handle(new ReleaseReservationCommand(id, meta)));
    }

    @PostMapping("/{propertyId}/mark-sold")
    public ResponseEntity<Void> markSold(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt, (id, meta) -> markSold.handle(new MarkPropertySoldCommand(id, meta)));
    }

    @PostMapping("/{propertyId}/mark-rented")
    public ResponseEntity<Void> markRented(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        return transition(propertyId, jwt,
                (id, meta) -> markRented.handle(new MarkPropertyRentedCommand(id, meta)));
    }

    private ResponseEntity<Void> transition(UUID propertyId, Jwt jwt, BiConsumer<PropertyId, CommandMetadata> run) {
        run.accept(new PropertyId(propertyId), agent(jwt));
        return ResponseEntity.noContent().build();
    }

    private static CommandMetadata agent(Jwt jwt) {
        return CommandMetadata.agent(CurrentUser.id(jwt), CorrelationIdFilter.current());
    }

    static Money money(MoneyDto dto) {
        return new Money(dto.amount(), dto.currency());
    }

    static Location location(LocationDto dto) {
        return new Location(dto.zone(), dto.address(), dto.latitude(), dto.longitude());
    }
}
