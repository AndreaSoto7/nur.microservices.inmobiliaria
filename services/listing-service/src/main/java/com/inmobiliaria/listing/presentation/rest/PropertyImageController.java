package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.application.query.GetPropertyImageHandler;
import com.inmobiliaria.listing.application.query.GetPropertyImageQuery;
import com.inmobiliaria.listing.application.query.ImageContent;
import java.time.Duration;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** Imagen pública de la galería. 404 si la propiedad está en DRAFT o PAUSED. */
@RestController
public class PropertyImageController {

    private final GetPropertyImageHandler getImage;

    public PropertyImageController(GetPropertyImageHandler getImage) {
        this.getImage = getImage;
    }

    @GetMapping("/api/v1/properties/{propertyId}/images/{imageId}")
    public ResponseEntity<byte[]> get(@PathVariable UUID propertyId, @PathVariable UUID imageId) {
        ImageContent image = getImage.handleOrThrow(new GetPropertyImageQuery(propertyId, imageId));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                .body(image.bytes());
    }
}
