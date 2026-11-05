package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.application.common.ImageUrls;
import com.inmobiliaria.listing.application.common.PageRequest;
import com.inmobiliaria.listing.application.common.PageResult;
import com.inmobiliaria.listing.application.query.CatalogCriteria;
import com.inmobiliaria.listing.application.query.CatalogReadModel;
import com.inmobiliaria.listing.application.query.PropertySummaryView;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** Búsqueda en property_catalog. Solo contiene propiedades PUBLISHED o RESERVED. */
@Component
public class JdbcCatalogReadModel implements CatalogReadModel {

    private static final Map<String, String> SORT_COLUMNS = Map.of(
            "price", "price_amount", "publishedAt", "published_at", "areaM2", "area_m2", "bedrooms", "bedrooms");

    private static final RowMapper<PropertySummaryView> ROW = (rs, n) -> {
        UUID id = rs.getObject("property_id", UUID.class);
        UUID cover = rs.getObject("cover_image_id", UUID.class);
        return new PropertySummaryView(id, rs.getString("title"), rs.getString("property_type"),
                rs.getString("operation_type"), rs.getString("status"), rs.getBigDecimal("price_amount"), "BOB",
                rs.getString("zone"), SqlSupport.integer(rs, "bedrooms"), SqlSupport.integer(rs, "bathrooms"),
                rs.getBigDecimal("area_m2"), SqlSupport.strings(rs, "features"),
                cover == null ? null : ImageUrls.of(id, cover), SqlSupport.instant(rs, "published_at"),
                SqlSupport.instant(rs, "updated_at"));
    };

    private final NamedParameterJdbcTemplate jdbc;

    public JdbcCatalogReadModel(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public PageResult<PropertySummaryView> search(CatalogCriteria criteria, PageRequest page) {
        List<SqlFilter> filters = CatalogSqlSpecifications.from(criteria);
        Map<String, Object> params = new HashMap<>();
        filters.forEach(f -> params.putAll(f.params()));
        String where = filters.isEmpty() ? "" : " WHERE " + filters.stream().map(SqlFilter::condition)
                .collect(Collectors.joining(" AND "));

        Long total = jdbc.queryForObject("SELECT count(*) FROM property_catalog" + where, params, Long.class);
        params.put("limit", page.size());
        params.put("offset", page.offset());
        List<PropertySummaryView> rows = jdbc.query("SELECT * FROM property_catalog" + where
                + SqlSupport.orderBy(page, SORT_COLUMNS, "published_at DESC, property_id")
                + " LIMIT :limit OFFSET :offset", params, ROW);
        return new PageResult<>(rows, page.page(), page.size(), total == null ? 0 : total);
    }
}
