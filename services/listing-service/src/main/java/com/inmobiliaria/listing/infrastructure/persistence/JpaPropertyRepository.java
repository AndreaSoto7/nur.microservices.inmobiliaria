package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * Adaptador del puerto PropertyRepository con JPA. La entidad queda administrada dentro de la transacción:
 * al guardar se copian los cambios sobre la misma instancia, y @Version detecta escrituras concurrentes.
 */
@Repository
public class JpaPropertyRepository implements PropertyRepository {

    @PersistenceContext
    private EntityManager em;

    @Override
    public Optional<Property> findById(PropertyId id) {
        return Optional.ofNullable(em.find(PropertyJpaEntity.class, id.value())).map(PropertyMapper::toDomain);
    }

    @Override
    public void save(Property property) {
        PropertyJpaEntity entity = em.find(PropertyJpaEntity.class, property.id().value());
        if (entity == null) {
            entity = new PropertyJpaEntity(property.id().value());
            PropertyMapper.copy(property, entity);
            em.persist(entity);
        } else {
            PropertyMapper.copy(property, entity);
        }
    }

    @Override
    public List<PropertyId> findAllIds() {
        return em.createQuery("SELECT p.id FROM PropertyJpaEntity p ORDER BY p.id", UUID.class).getResultList()
                .stream().map(PropertyId::new).toList();
    }
}
