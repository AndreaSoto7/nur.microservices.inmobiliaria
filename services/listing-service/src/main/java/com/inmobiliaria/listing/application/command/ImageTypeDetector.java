package com.inmobiliaria.listing.application.command;

import java.util.Optional;

/**
 * Detecta el tipo real de una imagen por sus primeros bytes (firma), sin confiar en el Content-Type ni en
 * la extensión que manda el cliente (rule seguridad).
 */
public final class ImageTypeDetector {

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};

    private ImageTypeDetector() {
    }

    public static Optional<String> detect(byte[] content) {
        if (startsWith(content, JPEG)) {
            return Optional.of("image/jpeg");
        }
        if (startsWith(content, PNG)) {
            return Optional.of("image/png");
        }
        return Optional.empty();
    }

    public static String extension(String contentType) {
        return "image/png".equals(contentType) ? "png" : "jpg";
    }

    private static boolean startsWith(byte[] content, byte[] signature) {
        if (content == null || content.length < signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if (content[i] != signature[i]) {
                return false;
            }
        }
        return true;
    }
}
