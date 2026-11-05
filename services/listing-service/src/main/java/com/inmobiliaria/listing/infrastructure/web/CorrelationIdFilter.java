package com.inmobiliaria.listing.infrastructure.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Toma el X-Correlation-Id que manda el gateway (o genera uno), lo deja en el MDC para los logs y lo
 * devuelve en la respuesta. Corre antes de la seguridad para que los 401 también lo lleven.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Correlation-Id";
    public static final String MDC_KEY = "correlationId";
    // Un valor arbitrario del cliente iría a los logs y al JSON de error: solo se acepta este formato.
    private static final Pattern VALID = Pattern.compile("[A-Za-z0-9-]{1,64}");

    /** El id de la petición en curso; fuera de una petición HTTP genera uno nuevo. */
    public static String current() {
        String correlationId = MDC.get(MDC_KEY);
        return correlationId != null ? correlationId : UUID.randomUUID().toString();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader(HEADER);
        String correlationId = incoming != null && VALID.matcher(incoming).matches()
                ? incoming
                : UUID.randomUUID().toString();
        MDC.put(MDC_KEY, correlationId);
        response.setHeader(HEADER, correlationId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}
