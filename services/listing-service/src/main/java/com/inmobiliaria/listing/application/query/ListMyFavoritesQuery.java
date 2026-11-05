package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.common.PageRequest;
import java.util.UUID;

public record ListMyFavoritesQuery(UUID userId, PageRequest page) {
}
