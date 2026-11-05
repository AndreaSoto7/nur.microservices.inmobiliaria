package com.inmobiliaria.listing.presentation.rest;

import com.inmobiliaria.listing.application.exception.ApplicationException;
import com.inmobiliaria.listing.application.exception.NotPropertyOwnerException;
import com.inmobiliaria.listing.domain.exception.DomainException;
import com.inmobiliaria.listing.domain.exception.InvalidValueException;
import com.inmobiliaria.listing.infrastructure.web.CorrelationIdFilter;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Traduce excepciones a RFC 9457 con {@code code} estable y {@code correlationId} (rule api-rest).
 * Nunca expone stack traces ni mensajes internos.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String TYPE_BASE = "https://inmobiliaria.local/problems/";

    private static final Map<Integer, String> GENERIC_CODES = Map.of(
            400, "BAD_REQUEST",
            401, "AUTH_UNAUTHORIZED",
            403, "PERMISSION_DENIED",
            404, "NOT_FOUND",
            405, "METHOD_NOT_ALLOWED",
            406, "NOT_ACCEPTABLE",
            409, "CONFLICT",
            413, "CONTENT_TOO_LARGE",
            415, "UNSUPPORTED_MEDIA_TYPE",
            500, "INTERNAL_ERROR");

    /** Recurso que no existe o que no es del usuario (application/exception). */
    @ExceptionHandler(ApplicationException.class)
    ResponseEntity<ProblemDetail> handleApplication(ApplicationException e) {
        boolean forbidden = e instanceof NotPropertyOwnerException;
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                forbidden ? HttpStatus.FORBIDDEN : HttpStatus.NOT_FOUND, e.getMessage());
        problem.setTitle(forbidden ? "Sin permiso" : "No encontrado");
        return build(problem, e.code());
    }

    /** Dos ediciones a la vez sobre la misma propiedad (@Version): el segundo reintenta. */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ProblemDetail> handleConcurrentUpdate(OptimisticLockingFailureException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "La propiedad cambió mientras la editabas; vuelve a intentarlo");
        problem.setTitle("Edición concurrente");
        return build(problem, "PROPERTY_CONCURRENT_UPDATE");
    }

    /** Parámetros que no se pueden interpretar (un enum o un orden desconocido). */
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ProblemDetail> handleIllegalArgument(IllegalArgumentException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        problem.setTitle("Solicitud inválida");
        return build(problem, "BAD_REQUEST");
    }

    /** Datos inválidos que detecta el dominio (precio, zona, título, imagen): 400, como la validación. */
    @ExceptionHandler(InvalidValueException.class)
    ResponseEntity<ProblemDetail> handleInvalidValue(InvalidValueException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        problem.setTitle("Dato inválido");
        return build(problem, e.code());
    }

    /** Reglas de negocio y transiciones inválidas: 409 (rule ddd-clean-architecture). */
    @ExceptionHandler(DomainException.class)
    ResponseEntity<ProblemDetail> handleDomain(DomainException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
        problem.setTitle("Regla de negocio incumplida");
        return build(problem, e.code());
    }

    /** Lo lanza @PreAuthorize: sin esto caería en el 500 de abajo. */
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ProblemDetail> handleAccessDenied(AccessDeniedException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN, "Tu rol no puede realizar esta operación");
        problem.setTitle("Sin permiso");
        return build(problem, "PERMISSION_DENIED");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> handleUnexpected(Exception e) {
        log.error("Error no controlado", e);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "Ocurrió un error inesperado");
        problem.setTitle("Error interno");
        return build(problem, "INTERNAL_ERROR");
    }

    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(MaxUploadSizeExceededException e,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONTENT_TOO_LARGE, "Cada imagen pesa como máximo 5 MB");
        problem.setTitle("Archivo demasiado grande");
        return new ResponseEntity<>(enrich(problem, "PROPERTY_IMAGE_TOO_LARGE"), headers,
                HttpStatus.CONTENT_TOO_LARGE);
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException e, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Hay campos con valores inválidos");
        problem.setTitle("Error de validación");
        List<Map<String, String>> errors = e.getBindingResult().getFieldErrors().stream()
                .map(f -> Map.of("field", f.getField(), "message", String.valueOf(f.getDefaultMessage())))
                .toList();
        problem.setProperty("errors", errors);
        return new ResponseEntity<>(enrich(problem, "VALIDATION_ERROR"), headers, HttpStatus.BAD_REQUEST);
    }

    /** Los errores estándar de Spring MVC (404, 405, 415...) también llevan code y correlationId. */
    @Override
    protected ResponseEntity<Object> createResponseEntity(
            Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        if (body instanceof ProblemDetail problem && problem.getProperties() == null) {
            enrich(problem, GENERIC_CODES.getOrDefault(statusCode.value(), "ERROR"));
        }
        return super.createResponseEntity(body, headers, statusCode, request);
    }

    private static ResponseEntity<ProblemDetail> build(ProblemDetail problem, String code) {
        return ResponseEntity.status(problem.getStatus()).body(enrich(problem, code));
    }

    private static ProblemDetail enrich(ProblemDetail problem, String code) {
        problem.setType(URI.create(TYPE_BASE + code.toLowerCase().replace('_', '-')));
        problem.setProperty("code", code);
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId != null) {
            problem.setProperty("correlationId", correlationId);
        }
        return problem;
    }
}
