package com.inmobiliaria.listing.infrastructure.storage;

import com.inmobiliaria.listing.application.port.ImageStorage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Adapter de ImageStorage sobre el disco local (un volumen de Docker). Escribe en un archivo temporal y
 * lo mueve de forma atómica, para que nadie lea una imagen a medio escribir.
 */
@Component
public class LocalImageStorage implements ImageStorage {

    private final Path root;

    public LocalImageStorage(@Value("${listing.images.dir}") String directory) {
        this.root = Path.of(directory).toAbsolutePath().normalize();
    }

    @Override
    public void store(String storageKey, byte[] content) {
        Path target = resolve(storageKey);
        try {
            Files.createDirectories(target.getParent());
            Path temp = Files.createTempFile(target.getParent(), ".upload-", ".tmp");
            try {
                Files.write(temp, content);
                Files.move(temp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } finally {
                Files.deleteIfExists(temp);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo guardar la imagen", e);
        }
    }

    @Override
    public Optional<byte[]> load(String storageKey) {
        try {
            return Optional.of(Files.readAllBytes(resolve(storageKey)));
        } catch (NoSuchFileException e) {
            return Optional.empty();
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer la imagen", e);
        }
    }

    @Override
    public void delete(String storageKey) {
        try {
            Files.deleteIfExists(resolve(storageKey));
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo borrar la imagen", e);
        }
    }

    /** La clave la genera el dominio, pero igual se impide salir del directorio (path traversal). */
    private Path resolve(String storageKey) {
        Path path = root.resolve(storageKey).normalize();
        if (!path.startsWith(root) || path.equals(root)) {
            throw new IllegalArgumentException("Clave de imagen inválida");
        }
        return path;
    }
}
