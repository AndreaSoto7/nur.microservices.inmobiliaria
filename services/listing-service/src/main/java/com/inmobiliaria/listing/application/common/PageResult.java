package com.inmobiliaria.listing.application.common;

import java.util.List;
import java.util.function.Function;

public record PageResult<T>(List<T> content, int number, int size, long totalElements) {

    public PageResult {
        content = List.copyOf(content);
    }

    public int totalPages() {
        return size == 0 ? 0 : (int) ((totalElements + size - 1) / size);
    }

    public <R> PageResult<R> map(Function<T, R> mapper) {
        return new PageResult<>(content.stream().map(mapper).toList(), number, size, totalElements);
    }
}
