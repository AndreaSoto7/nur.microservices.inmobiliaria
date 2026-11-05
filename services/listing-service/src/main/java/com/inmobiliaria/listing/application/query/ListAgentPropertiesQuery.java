package com.inmobiliaria.listing.application.query;

import com.inmobiliaria.listing.application.common.PageRequest;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import java.util.Optional;
import java.util.UUID;

public record ListAgentPropertiesQuery(UUID agentId, Optional<PropertyStatus> status, PageRequest page) {
}
