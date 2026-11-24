package com.inmobiliaria.listing.application.common;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Forma comparable de un texto para buscar: minúsculas, sin tildes y con un solo espacio entre palabras.
 * La usan el filtro del catálogo y la proyección que guarda zone_normalized, así los dos lados coinciden.
 */
public final class SearchText {

    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    /** Quien busca escribe "zona norte"; las zonas se guardan como "Norte". */
    private static final String ZONE_PREFIX = "zona ";

    private SearchText() {
    }

    public static String normalize(String text) {
        String withoutMarks = MARKS.matcher(Normalizer.normalize(text, Normalizer.Form.NFD)).replaceAll("");
        return SPACES.matcher(withoutMarks.trim()).replaceAll(" ").toLowerCase(Locale.ROOT);
    }

    /** Término del filtro de zona, o null si no queda nada que buscar. */
    public static String zoneTerm(String text) {
        if (text == null) {
            return null;
        }
        String term = normalize(text);
        if (term.equals("zona")) {
            return null;
        }
        if (term.startsWith(ZONE_PREFIX)) {
            term = term.substring(ZONE_PREFIX.length());
        }
        return term.isEmpty() ? null : term;
    }
}
