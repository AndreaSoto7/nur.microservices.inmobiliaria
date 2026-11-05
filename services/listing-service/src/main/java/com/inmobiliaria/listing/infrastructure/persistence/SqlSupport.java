package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.application.common.PageRequest;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

final class SqlSupport {

    private SqlSupport() {
    }

    /** ORDER BY a partir de una lista blanca: el nombre de columna nunca sale del request. */
    static String orderBy(PageRequest page, Map<String, String> columns, String defaultOrder) {
        if (page.sort().isEmpty()) {
            return " ORDER BY " + defaultOrder;
        }
        return " ORDER BY " + page.sort().stream()
                .map(s -> columns.get(s.field()) + (s.ascending() ? " ASC" : " DESC"))
                .collect(Collectors.joining(", ")) + ", " + defaultOrder;
    }

    static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp ts = rs.getTimestamp(column);
        return ts == null ? null : ts.toInstant();
    }

    static Integer integer(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    static List<String> strings(ResultSet rs, String column) throws SQLException {
        Array array = rs.getArray(column);
        if (array == null) {
            return List.of();
        }
        return Arrays.stream((Object[]) array.getArray()).map(String::valueOf).toList();
    }
}
