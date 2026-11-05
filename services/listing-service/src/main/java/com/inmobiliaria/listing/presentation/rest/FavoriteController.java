package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.application.command.AddFavoriteCommand;
import com.inmobiliaria.listing.application.command.AddFavoriteHandler;
import com.inmobiliaria.listing.application.command.RemoveFavoriteCommand;
import com.inmobiliaria.listing.application.command.RemoveFavoriteHandler;
import com.inmobiliaria.listing.application.query.ListMyFavoritesHandler;
import com.inmobiliaria.listing.application.query.ListMyFavoritesQuery;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.presentation.rest.dto.AddFavoriteRequest;
import com.inmobiliaria.listing.presentation.rest.dto.FavoriteResponse;
import com.inmobiliaria.listing.presentation.rest.dto.PageResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Favoritos del usuario autenticado (ADR 0003). Cada uno ve y gestiona solo los suyos. */
@RestController
@RequestMapping("/api/v1/favorites")
@PreAuthorize("hasAnyRole('CLIENT', 'AGENT')")
public class FavoriteController {

    private final AddFavoriteHandler add;
    private final RemoveFavoriteHandler remove;
    private final ListMyFavoritesHandler list;

    public FavoriteController(AddFavoriteHandler add, RemoveFavoriteHandler remove, ListMyFavoritesHandler list) {
        this.add = add;
        this.remove = remove;
        this.list = list;
    }

    @GetMapping
    public PageResponse<FavoriteResponse> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        var result = list.handle(new ListMyFavoritesQuery(CurrentUser.id(jwt),
                PageParams.of(page, size, List.of(), Set.of())));
        return PageResponse.of(result, FavoriteResponse::from);
    }

    @PostMapping
    public ResponseEntity<Void> add(@Valid @RequestBody AddFavoriteRequest body, @AuthenticationPrincipal Jwt jwt) {
        add.handle(new AddFavoriteCommand(CurrentUser.id(jwt), new PropertyId(body.propertyId())));
        return ResponseEntity.created(URI.create("/api/v1/favorites/" + body.propertyId())).build();
    }

    @DeleteMapping("/{propertyId}")
    public ResponseEntity<Void> remove(@PathVariable UUID propertyId, @AuthenticationPrincipal Jwt jwt) {
        remove.handle(new RemoveFavoriteCommand(CurrentUser.id(jwt), new PropertyId(propertyId)));
        return ResponseEntity.noContent().build();
    }
}
