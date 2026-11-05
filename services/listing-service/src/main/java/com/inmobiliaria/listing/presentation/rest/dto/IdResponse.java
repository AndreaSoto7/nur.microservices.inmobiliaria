package com.inmobiliaria.listing.presentation.rest.dto;

import java.util.UUID;

/** Un comando devuelve como máximo el id creado (CQRS). */
public record IdResponse(UUID id) {
}
