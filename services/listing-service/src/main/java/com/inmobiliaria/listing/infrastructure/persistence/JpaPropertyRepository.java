package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.domain.exception.ConcurrentPropertyModificationException;
import com.inmobiliaria.listing.domain.model.Property;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.PropertyRepository;
import java.util.Objects;
import java.util.Optional;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Repository;

/** Adapter del puerto PropertyRepository sobre Spring Data JPA. */
@Repository
public class JpaPropertyRepository implements PropertyRepository {

    private final PropertyJpaRepository jpa;

    public JpaPropertyRepository(PropertyJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public Optional<Property> findById(PropertyId id) {
        return jpa.findById(id.value()).map(PropertyMapper::toDomain);
    }

    @Override
    public void save(Property property) {
        PropertyJpaEntity entity = property.version() == null
                ? new PropertyJpaEntity(property.id().value())
                : jpa.findById(property.id().value()).orElseThrow(ConcurrentPropertyModificationException::new);
        // La versión cargada debe ser la que tenía el aggregate: si no, alguien la cambió en el medio.
        if (property.version() != null && !Objects.equals(entity.getVersion(), property.version())) {
            throw new ConcurrentPropertyModificationException();
        }
        PropertyMapper.copy(property, entity);
        try {
            // flush aquí: el UPDATE ... WHERE version = ? falla ahora y no recién en el commit.
            jpa.saveAndFlush(entity);
        } catch (OptimisticLockingFailureException e) {
            throw new ConcurrentPropertyModificationException();
        }
    }
}
