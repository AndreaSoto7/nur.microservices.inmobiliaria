package com.inmobiliaria.listing.infrastructure.persistence;

import com.inmobiliaria.listing.domain.model.Favorite;
import com.inmobiliaria.listing.domain.model.FavoriteId;
import com.inmobiliaria.listing.domain.model.PropertyId;
import com.inmobiliaria.listing.domain.repository.FavoriteRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class JpaFavoriteRepository implements FavoriteRepository {

    private final FavoriteSpringDataRepository jpa;

    @PersistenceContext
    private EntityManager em;

    public JpaFavoriteRepository(FavoriteSpringDataRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public Optional<Favorite> find(UUID userId, PropertyId propertyId) {
        return jpa.findByUserIdAndPropertyId(userId, propertyId.value()).map(e -> Favorite.reconstitute(
                new FavoriteId(e.id), e.userId, new PropertyId(e.propertyId), e.createdAt));
    }

    @Override
    public boolean exists(UUID userId, PropertyId propertyId) {
        return jpa.existsByUserIdAndPropertyId(userId, propertyId.value());
    }

    @Override
    public void save(Favorite favorite) {
        // persist (no merge): el id lo genera el dominio y el favorito no se modifica después.
        em.persist(new FavoriteJpaEntity(favorite.id().value(), favorite.userId(), favorite.propertyId().value(),
                favorite.createdAt()));
    }

    @Override
    public void delete(Favorite favorite) {
        jpa.deleteById(favorite.id().value());
    }
}
