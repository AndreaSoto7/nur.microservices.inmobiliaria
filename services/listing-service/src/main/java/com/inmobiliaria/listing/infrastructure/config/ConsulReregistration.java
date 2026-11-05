package com.inmobiliaria.listing.infrastructure.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cloud.consul.serviceregistry.ConsulAutoRegistration;
import org.springframework.cloud.consul.serviceregistry.ConsulServiceRegistry;
import org.springframework.context.ApplicationListener;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Repite el registro en Consul cada 60 s (rule service-discovery): Consul en modo dev guarda todo en
 * memoria, y si se reinicia o borra una réplica que estuvo crítica, así vuelve a aparecer sola.
 *
 * <p>El ciclo se corta con el ContextClosedEvent, que llega antes de la baja que hace Spring Cloud al
 * destruir sus beans: un registro tardío revive una réplica muerta.
 */
@Component
public class ConsulReregistration implements ApplicationListener<ContextClosedEvent> {

    private static final Logger log = LoggerFactory.getLogger(ConsulReregistration.class);

    private final ObjectProvider<ConsulServiceRegistry> registry;
    private final ObjectProvider<ConsulAutoRegistration> registration;
    private volatile boolean stopping;

    public ConsulReregistration(
            ObjectProvider<ConsulServiceRegistry> registry, ObjectProvider<ConsulAutoRegistration> registration) {
        this.registry = registry;
        this.registration = registration;
    }

    @Scheduled(initialDelayString = "PT60S", fixedDelayString = "PT60S")
    void reregister() {
        ConsulServiceRegistry serviceRegistry = registry.getIfAvailable();
        ConsulAutoRegistration current = registration.getIfAvailable();
        if (stopping || serviceRegistry == null || current == null) {
            return;
        }
        try {
            serviceRegistry.register(current);
        } catch (RuntimeException e) {
            // Consul caído no debe tumbar el servicio: se reintenta en el próximo ciclo.
            log.warn("No se pudo repetir el registro en Consul: {}", e.getMessage());
        }
    }

    @Override
    public void onApplicationEvent(ContextClosedEvent event) {
        stopping = true;
    }
}
