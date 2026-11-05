package com.inmobiliaria.listing.infrastructure.persistence;

import java.util.Map;

/**
 * Patrón Specification aplicado a SQL: cada filtro del catálogo aporta su condición y sus parámetros, y se
 * combinan con AND. Los valores siempre van como parámetros, nunca concatenados.
 */
record SqlFilter(String condition, Map<String, Object> params) {

    static SqlFilter of(String condition, String name, Object value) {
        return new SqlFilter(condition, Map.of(name, value));
    }
}
