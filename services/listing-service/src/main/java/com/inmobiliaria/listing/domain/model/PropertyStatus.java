package com.inmobiliaria.listing.domain.model;

/** Estado de publicación. Las transiciones las controla {@link Property}. */
public enum PropertyStatus {
    DRAFT,
    PUBLISHED,
    PAUSED,
    RESERVED,
    SOLD,
    RENTED;

    /** Visible en el catálogo público. */
    public boolean isListed() {
        return this == PUBLISHED || this == RESERVED;
    }

    /** Vendida o alquilada: ya no se edita. */
    public boolean isClosed() {
        return this == SOLD || this == RENTED;
    }
}
