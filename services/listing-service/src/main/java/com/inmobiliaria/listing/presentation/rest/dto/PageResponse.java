package com.inmobiliaria.listing.presentation.rest.dto;

import com.inmobiliaria.listing.application.common.PageResult;
import java.util.List;
import java.util.function.Function;

/** Envoltorio de colecciones de la rule api-rest: { data, page }. */
public record PageResponse<T>(List<T> data, PageMeta page) {

    public record PageMeta(int number, int size, long totalElements, int totalPages) {
    }

    public static <S, T> PageResponse<T> of(PageResult<S> result, Function<S, T> mapper) {
        return new PageResponse<>(result.content().stream().map(mapper).toList(),
                new PageMeta(result.number(), result.size(), result.totalElements(), result.totalPages()));
    }
}
