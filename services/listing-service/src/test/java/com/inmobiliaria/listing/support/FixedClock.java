package com.inmobiliaria.listing.support;

import com.inmobiliaria.listing.application.port.Clock;
import java.time.Instant;

public class FixedClock implements Clock {

    private Instant now;

    public FixedClock(Instant now) {
        this.now = now;
    }

    @Override
    public Instant now() {
        return now;
    }

    public void set(Instant now) {
        this.now = now;
    }
}
