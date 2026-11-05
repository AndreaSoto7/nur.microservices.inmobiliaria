package com.inmobiliaria.listing.infrastructure.config;

import com.inmobiliaria.listing.infrastructure.web.CorrelationIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/**
 * Responde 401 y 403 en problem+json. Corre en el filtro de seguridad, antes de Spring MVC, así que
 * no pasa por el GlobalExceptionHandler. No detalla por qué falló el token.
 */
@Component
public class ProblemJsonSecurityHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException e)
            throws IOException {
        response.setHeader("WWW-Authenticate", "Bearer");
        write(request, response, HttpStatus.UNAUTHORIZED, "unauthorized", "No autenticado",
                "Falta el access token o no es válido", "AUTH_UNAUTHORIZED");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException e)
            throws IOException {
        write(request, response, HttpStatus.FORBIDDEN, "permission-denied", "Sin permiso",
                "Tu rol no puede realizar esta operación", "PERMISSION_DENIED");
    }

    private static void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status,
            String type, String title, String detail, String code) throws IOException {
        // correlationId ya viene validado por CorrelationIdFilter (solo [A-Za-z0-9-]).
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        String body = "{\"type\":\"https://inmobiliaria.local/problems/" + type + "\""
                + ",\"title\":\"" + title + "\""
                + ",\"status\":" + status.value()
                + ",\"detail\":\"" + detail + "\""
                + ",\"instance\":\"" + escape(request.getRequestURI()) + "\""
                + ",\"code\":\"" + code + "\""
                + (correlationId == null ? "" : ",\"correlationId\":\"" + correlationId + "\"")
                + "}";
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(body);
    }

    private static String escape(String value) {
        StringBuilder out = new StringBuilder(value.length());
        for (char c : value.toCharArray()) {
            if (c == '"' || c == '\\') {
                out.append('\\').append(c);
            } else if (c < 0x20) {
                out.append(String.format("\\u%04x", (int) c));
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }
}
