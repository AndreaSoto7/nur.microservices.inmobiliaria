package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.application.common.ImageUrls;
import com.inmobiliaria.listing.application.common.PageRequest;
import com.inmobiliaria.listing.application.common.PageResult;
import com.inmobiliaria.listing.application.query.FavoriteView;
import com.inmobiliaria.listing.application.query.PropertyReadModel;
import com.inmobiliaria.listing.application.query.PropertySummaryView;
import com.inmobiliaria.listing.domain.model.PropertyStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** Consultas del agente y de favoritos: leen properties directo (todos los estados) y nunca escriben. */
@Component
public class JdbcPropertyReadModel implements PropertyReadModel {

    private static final Map<String, String> SORT_COLUMNS = Map.of(
            "createdAt", "p.created_at", "updatedAt", "p.updated_at", "price", "p.price_amount", "title", "p.title");

    /** Columnas de una fila resumida, con la portada (posición 0) y las características. */
    private static final String SUMMARY_COLUMNS = """
            p.id, p.title, p.property_type, p.operation_type, p.status, p.price_amount, p.price_currency, p.zone,
            p.bedrooms, p.bathrooms, p.area_m2, p.published_at, p.updated_at,
            (SELECT i.id FROM property_images i WHERE i.property_id = p.id ORDER BY i.position LIMIT 1) AS cover_id,
            ARRAY(SELECT f.feature FROM property_features f WHERE f.property_id = p.id ORDER BY f.feature)
                AS features
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public JdbcPropertyReadModel(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public PageResult<PropertySummaryView> listByAgent(UUID agentId, Optional<PropertyStatus> status,
            PageRequest page) {
        Map<String, Object> params = new HashMap<>();
        params.put("agentId", agentId);
        String where = " WHERE p.agent_id = :agentId";
        if (status.isPresent()) {
            where += " AND p.status = :status";
            params.put("status", status.get().name());
        }
        Long total = jdbc.queryForObject("SELECT count(*) FROM properties p" + where, params, Long.class);
        params.put("limit", page.size());
        params.put("offset", page.offset());
        List<PropertySummaryView> rows = jdbc.query("SELECT " + SUMMARY_COLUMNS + " FROM properties p" + where
                + SqlSupport.orderBy(page, SORT_COLUMNS, "p.created_at DESC, p.id")
                + " LIMIT :limit OFFSET :offset", params, (rs, n) -> summary(rs));
        return new PageResult<>(rows, page.page(), page.size(), total == null ? 0 : total);
    }

    @Override
    public PageResult<FavoriteView> listFavorites(UUID userId, PageRequest page) {
        Map<String, Object> params = new HashMap<>();
        params.put("userId", userId);
        Long total = jdbc.queryForObject("SELECT count(*) FROM favorites WHERE user_id = :userId", params,
                Long.class);
        params.put("limit", page.size());
        params.put("offset", page.offset());
        List<FavoriteView> rows = jdbc.query("SELECT " + SUMMARY_COLUMNS + ", fav.created_at AS saved_at"
                + " FROM favorites fav JOIN properties p ON p.id = fav.property_id WHERE fav.user_id = :userId"
                + " ORDER BY fav.created_at DESC, fav.id LIMIT :limit OFFSET :offset", params,
                (rs, n) -> new FavoriteView(summary(rs), SqlSupport.instant(rs, "saved_at")));
        return new PageResult<>(rows, page.page(), page.size(), total == null ? 0 : total);
    }

    @Override
    public Optional<ImageLocation> findImage(UUID propertyId, UUID imageId) {
        return jdbc.query("""
                SELECT p.status, i.content_type, i.storage_key
                FROM property_images i JOIN properties p ON p.id = i.property_id
                WHERE i.id = :imageId AND i.property_id = :propertyId
                """, Map.of("imageId", imageId, "propertyId", propertyId),
                (rs, n) -> new ImageLocation(rs.getString("status"), rs.getString("content_type"),
                        rs.getString("storage_key"))).stream().findFirst();
    }

    private static PropertySummaryView summary(ResultSet rs) throws SQLException {
        UUID id = rs.getObject("id", UUID.class);
        UUID cover = rs.getObject("cover_id", UUID.class);
        return new PropertySummaryView(id, rs.getString("title"), rs.getString("property_type"),
                rs.getString("operation_type"), rs.getString("status"), rs.getBigDecimal("price_amount"),
                rs.getString("price_currency"), rs.getString("zone"), SqlSupport.integer(rs, "bedrooms"),
                SqlSupport.integer(rs, "bathrooms"), rs.getBigDecimal("area_m2"), SqlSupport.strings(rs, "features"),
                cover == null ? null : ImageUrls.of(id, cover), SqlSupport.instant(rs, "published_at"),
                SqlSupport.instant(rs, "updated_at"));
    }
}
