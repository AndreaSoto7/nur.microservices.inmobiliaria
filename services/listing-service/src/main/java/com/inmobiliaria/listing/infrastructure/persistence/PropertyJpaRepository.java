package com.inmobiliaria.listing.infrastructure.persistence;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PropertyJpaRepository extends JpaRepository<PropertyJpaEntity, UUID> {

    Page<PropertyJpaEntity> findByAgentId(UUID agentId, Pageable pageable);

    Page<PropertyJpaEntity> findByAgentIdAndStatus(UUID agentId, String status, Pageable pageable);
}
