package com.inmobiliaria.listing.application.port;

import java.util.Optional;

/** Puerto de salida para los archivos de la galería (Adapter: disco local hoy, MinIO si hiciera falta). */
public interface ImageStorage {

    /** Guarda el contenido bajo una clave generada por el sistema, nunca con el nombre original del archivo. */
    void store(String key, byte[] content);

    Optional<byte[]> load(String key);

    void delete(String key);
}
