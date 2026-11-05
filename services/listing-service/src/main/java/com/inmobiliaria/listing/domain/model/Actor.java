package com.inmobiliaria.listing.domain.model;

/** Quién pide un cambio. SYSTEM es una política que reacciona a un evento (ADR 0005). */
public enum Actor {
    CLIENT,
    AGENT,
    SYSTEM
}
