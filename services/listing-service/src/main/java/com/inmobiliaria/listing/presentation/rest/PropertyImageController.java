package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.application.command.AddPropertyImageHandler;
import com.inmobiliaria.listing.application.command.PropertyCommands.AddPropertyImageCommand;
import com.inmobiliaria.listing.application.query.PropertyQueries.GetPropertyImageQuery;
import com.inmobiliaria.listing.application.query.PropertyQueries.ImageContent;
import com.inmobiliaria.listing.application.query.PropertyQueryHandler;
import com.inmobiliaria.listing.application.query.PropertyViews;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.presentation.rest.PropertyRequests.CreatedResponse;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.time.Duration;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Galería. Subir es del agente dueño; ver es público si la propiedad está visible. */
@RestController
@RequestMapping("/api/v1/properties/{propertyId}/images")
public class PropertyImageController {

    private final AddPropertyImageHandler addImage;
    private final PropertyQueryHandler queries;

    public PropertyImageController(AddPropertyImageHandler addImage, PropertyQueryHandler queries) {
        this.addImage = addImage;
        this.queries = queries;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<CreatedResponse> add(@PathVariable UUID propertyId, @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) {
        // No se usan file.getOriginalFilename() ni file.getContentType(): el nombre lo genera el sistema
        // y el tipo se detecta del contenido (rule seguridad).
        UUID imageId = addImage.handle(new AddPropertyImageCommand(new PropertyId(propertyId),
                PropertyController.agentId(jwt), bytes(file)));
        return ResponseEntity.created(URI.create(PropertyViews.imageUrl(propertyId, imageId)))
                .body(new CreatedResponse(imageId.toString()));
    }

    @GetMapping("/{imageId}")
    public ResponseEntity<byte[]> get(@PathVariable UUID propertyId, @PathVariable UUID imageId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID viewer = jwt == null ? null : PropertyController.agentId(jwt);
        ImageContent image = queries.handle(new GetPropertyImageQuery(propertyId, imageId, viewer));
        // El contenido no cambia (cada subida tiene su ID), pero la visibilidad sí: si la propiedad se pausa,
        // una caché pública larga la seguiría mostrando. En DRAFT/PAUSED la ve solo el dueño: nada de caché.
        CacheControl cache = image.publiclyVisible()
                ? CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic()
                : CacheControl.noStore().cachePrivate();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .cacheControl(cache)
                .header("X-Content-Type-Options", "nosniff")
                .body(image.content());
    }

    private static byte[] bytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
