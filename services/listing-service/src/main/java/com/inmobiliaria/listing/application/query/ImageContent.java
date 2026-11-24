package com.inmobiliaria.listing.application.query;

/** publiclyVisible es false cuando solo la puede ver su dueño: no se debe guardar en cachés compartidas. */
public record ImageContent(String contentType, byte[] bytes, boolean publiclyVisible) {
}
