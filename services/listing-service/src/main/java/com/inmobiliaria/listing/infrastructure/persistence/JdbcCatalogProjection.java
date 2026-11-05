package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.application.port.CatalogProjection;
import com.inmobiliaria.listing.domain.model.Feature;
import com.inmobiliaria.listing.domain.model.Area;
import com.inmobiliaria.listing.domain.model.Property;
import java.sql.Timestamp;
import java.util.Locale;
import java.util.Map;
import java.util.HashMap;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Mantiene property_catalog (lado query de CQRS) con SQL directo: upsert si la propiedad está
 * PUBLISHED o RESERVED, borrado en cualquier otro estado. Corre en la transacción del comando.
 */
@Component
public class JdbcCatalogProjection implements CatalogProjection {

    private static final String UPSERT = """
            INSERT INTO property_catalog (property_id, agent_id, title, property_type, operation_type, status,
                price_amount, zone, zone_normalized, bedrooms, bathrooms, area_m2, features, cover_image_id,
                published_at, updated_at)
            VALUES (:id, :agentId, :title, :propertyType, :operationType, :status, :price, :zone, :zoneNormalized,
                :bedrooms, :bathrooms, :area, CAST(:features AS varchar(30)[]), :coverImageId, :publishedAt,
                :updatedAt)
            ON CONFLICT (property_id) DO UPDATE SET
                agent_id = EXCLUDED.agent_id, title = EXCLUDED.title, property_type = EXCLUDED.property_type,
                operation_type = EXCLUDED.operation_type, status = EXCLUDED.status,
                price_amount = EXCLUDED.price_amount, zone = EXCLUDED.zone,
                zone_normalized = EXCLUDED.zone_normalized, bedrooms = EXCLUDED.bedrooms,
                bathrooms = EXCLUDED.bathrooms, area_m2 = EXCLUDED.area_m2, features = EXCLUDED.features,
                cover_image_id = EXCLUDED.cover_image_id, published_at = EXCLUDED.published_at,
                updated_at = EXCLUDED.updated_at
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public JdbcCatalogProjection(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void sync(Property p) {
        if (!p.status().isListed()) {
            jdbc.update("DELETE FROM property_catalog WHERE property_id = :id", Map.of("id", p.id().value()));
            return;
        }
        Map<String, Object> params = new HashMap<>();
        params.put("id", p.id().value());
        params.put("agentId", p.agentId());
        params.put("title", p.title());
        params.put("propertyType", p.type().name());
        params.put("operationType", p.operation().name());
        params.put("status", p.status().name());
        params.put("price", p.price().amount());
        params.put("zone", p.location().zone());
        params.put("zoneNormalized", p.location().zone().toLowerCase(Locale.ROOT));
        params.put("bedrooms", p.bedrooms().orElse(null));
        params.put("bathrooms", p.bathrooms().orElse(null));
        params.put("area", p.area().map(Area::squareMeters).orElse(null));
        params.put("features", p.features().stream().map(Feature::name).sorted().toArray(String[]::new));
        params.put("coverImageId", p.images().isEmpty() ? null : p.images().getFirst().id());
        params.put("publishedAt", Timestamp.from(p.publishedAt().orElseThrow()));
        params.put("updatedAt", Timestamp.from(p.updatedAt()));
        jdbc.update(UPSERT, params);
    }
}
