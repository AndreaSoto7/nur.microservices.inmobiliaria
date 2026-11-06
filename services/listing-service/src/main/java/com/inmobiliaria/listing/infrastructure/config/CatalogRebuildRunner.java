package com.inmobiliaria.listing.infrastructure.config;

import com.inmobiliaria.listing.application.command.RebuildCatalogHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Dispara RebuildCatalogHandler al arrancar si CATALOG_REBUILD_ON_STARTUP=true. Es un comando de
 * mantenimiento: no se expone por HTTP para no cambiar el contrato público.
 */
@Component
@ConditionalOnProperty(name = "listing.catalog.rebuild-on-startup", havingValue = "true")
public class CatalogRebuildRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CatalogRebuildRunner.class);

    private final RebuildCatalogHandler rebuild;

    public CatalogRebuildRunner(RebuildCatalogHandler rebuild) {
        this.rebuild = rebuild;
    }

    @Override
    public void run(ApplicationArguments args) {
        int reviewed = rebuild.handle();
        log.info("Catálogo reconstruido desde properties: {} propiedades revisadas", reviewed);
    }
}
