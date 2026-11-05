package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.application.common.PageRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Convierte page, size y sort (campo,asc|desc, repetible) a PageRequest, con lista blanca de campos. */
public final class PageParams {

    private PageParams() {
    }

    public static PageRequest of(Integer page, Integer size, List<String> sort, Set<String> sortable) {
        int p = page == null ? 1 : page;
        int s = size == null ? PageRequest.DEFAULT_SIZE : size;
        List<PageRequest.SortOrder> orders = new ArrayList<>();
        if (sort != null) {
            // Spring separa "price,asc" en dos valores si llega un solo sort: se rearma por pares.
            List<String> tokens = new ArrayList<>();
            sort.forEach(value -> tokens.addAll(List.of(value.split(","))));
            for (int i = 0; i < tokens.size(); i++) {
                String field = tokens.get(i).trim();
                boolean ascending = true;
                if (i + 1 < tokens.size() && isDirection(tokens.get(i + 1))) {
                    ascending = tokens.get(++i).trim().equalsIgnoreCase("asc");
                }
                if (!sortable.contains(field)) {
                    throw new IllegalArgumentException("No se puede ordenar por '" + field + "'. Campos: "
                            + String.join(", ", sortable.stream().sorted().toList()));
                }
                orders.add(new PageRequest.SortOrder(field, ascending));
            }
        }
        return new PageRequest(p, s, orders);
    }

    private static boolean isDirection(String token) {
        String t = token.trim();
        return t.equalsIgnoreCase("asc") || t.equalsIgnoreCase("desc");
    }
}
