package com.inmobiliaria.listing.presentation.rest.dto;

import java.util.List;
import java.util.UUID;

public record ImagesAddedResponse(List<UUID> imageIds) {
}
