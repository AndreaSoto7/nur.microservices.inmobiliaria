package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.application.command.MovePropertyImageCommand;
import com.inmobiliaria.listing.application.command.MovePropertyImageHandler;
import com.inmobiliaria.listing.application.command.RemovePropertyImageCommand;
import com.inmobiliaria.listing.application.command.RemovePropertyImageHandler;
import com.inmobiliaria.listing.application.common.CommandMetadata;
import com.inmobiliaria.listing.application.query.GetPropertyImageHandler;
import com.inmobiliaria.listing.application.query.GetPropertyImageQuery;
import com.inmobiliaria.listing.application.query.ImageContent;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.infrastructure.web.CorrelationIdFilter;
import com.inmobiliaria.listing.presentation.rest.dto.MoveImageRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Imagen de la galería. El GET es público mientras la propiedad es visible; el agente dueño, con su token,
 * también ve las de un borrador o una propiedad pausada. Moverla (PATCH) y quitarla (DELETE) es solo del dueño.
 */
@RestController
public class PropertyImageController {

    private static final String PATH = "/api/v1/properties/{propertyId}/images/{imageId}";

    private final GetPropertyImageHandler getImage;
    private final RemovePropertyImageHandler removeImage;
    private final MovePropertyImageHandler moveImage;

    public PropertyImageController(GetPropertyImageHandler getImage, RemovePropertyImageHandler removeImage,
            MovePropertyImageHandler moveImage) {
        this.getImage = getImage;
        this.removeImage = removeImage;
        this.moveImage = moveImage;
    }

    @PatchMapping(PATH)
    public ResponseEntity<Void> move(@PathVariable UUID propertyId, @PathVariable UUID imageId,
            @Valid @RequestBody MoveImageRequest request, @AuthenticationPrincipal Jwt jwt) {
        moveImage.handle(new MovePropertyImageCommand(new PropertyId(propertyId), imageId, request.position(),
                CommandMetadata.agent(CurrentUser.id(jwt), CorrelationIdFilter.current())));
        return ResponseEntity.noContent().build();
    }

    @GetMapping(PATH)
    public ResponseEntity<byte[]> get(@PathVariable UUID propertyId, @PathVariable UUID imageId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID viewer = jwt == null ? null : CurrentUser.id(jwt);
        ImageContent image = getImage.handleOrThrow(new GetPropertyImageQuery(propertyId, imageId, viewer));
        // Una foto que solo ve su dueño no se guarda en cachés compartidas: dejaría de ser privada.
        CacheControl cache = image.publiclyVisible()
                ? CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic()
                : CacheControl.noStore().cachePrivate();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .cacheControl(cache)
                .header("X-Content-Type-Options", "nosniff")
                .body(image.bytes());
    }

    @DeleteMapping(PATH)
    public ResponseEntity<Void> remove(@PathVariable UUID propertyId, @PathVariable UUID imageId,
            @AuthenticationPrincipal Jwt jwt) {
        removeImage.handle(new RemovePropertyImageCommand(new PropertyId(propertyId), imageId,
                CommandMetadata.agent(CurrentUser.id(jwt), CorrelationIdFilter.current())));
        return ResponseEntity.noContent().build();
    }
}
