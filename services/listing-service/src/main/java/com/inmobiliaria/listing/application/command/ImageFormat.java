package com.inmobiliaria.listing.application.command;

/**
 * Detecta el tipo real de una imagen por sus primeros bytes (rule seguridad: el MIME que manda el
 * cliente o la extensión no se creen). Si no es JPG ni PNG, devuelve un tipo que el dominio rechaza.
 */
final class ImageFormat {

    static final String UNKNOWN = "application/octet-stream";

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};

    private ImageFormat() {}

    static String detect(byte[] content) {
        if (startsWith(content, JPEG)) return "image/jpeg";
        if (startsWith(content, PNG)) return "image/png";
        return UNKNOWN;
    }

    private static boolean startsWith(byte[] content, byte[] signature) {
        if (content == null || content.length < signature.length) return false;
        for (int i = 0; i < signature.length; i++) {
            if (content[i] != signature[i]) return false;
        }
        return true;
    }
}
