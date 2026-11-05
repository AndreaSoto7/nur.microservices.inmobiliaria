package com.inmobiliaria.listing.application.common;

import java.util.List;

/** Paginación de la rule api-rest: page empieza en 1, size por defecto 20 y máximo 100. */
public record PageRequest(int page, int size, List<SortOrder> sort) {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    public PageRequest {
        if (page < 1) {
            throw new IllegalArgumentException("page debe ser mayor o igual a 1");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new IllegalArgumentException("size debe estar entre 1 y " + MAX_SIZE);
        }
        sort = sort == null ? List.of() : List.copyOf(sort);
    }

    public long offset() {
        return (long) (page - 1) * size;
    }

    public record SortOrder(String field, boolean ascending) {
    }
}
