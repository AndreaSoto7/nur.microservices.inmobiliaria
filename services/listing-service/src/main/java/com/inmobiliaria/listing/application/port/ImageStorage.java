package com.inmobiliaria.listing.application.port;

import java.util.Optional;

/** Dónde viven los archivos de la galería (disco local hoy; MinIO o S3 mañana, patrón Adapter). */
public interface ImageStorage {

    /** Guarda el contenido bajo la clave dada. La clave nunca sale del nombre original del archivo. */
    void store(String storageKey, byte[] content);

    Optional<byte[]> load(String storageKey);

    void delete(String storageKey);
}
