import {
  InvalidProposedVisitDateError,
  InvalidVisitResolutionReasonError,
  Visit,
  VisitNotRequestedError,
  VisitCancellationTooLateError,
  VisitCompletionTooEarlyError,
  VisitNotScheduledError,
} from './visit.js';

describe('Visit', () => {
  function buildRequest() {
    return {
      id: 'visit-1',
      propertyId: 'property-1',
      clientId: 'client-1',
      agentId: 'agent-1',
      requestedAt: new Date('2026-11-05T15:00:00Z'),
      proposedAt: new Date('2026-11-06T15:00:00Z'),
    };
  }

  it('creates a pending visit linked by ID to the property', () => {
    const input = buildRequest();

    const visit = Visit.request(input);

    expect(visit).toMatchObject({ ...input, status: 'REQUESTED' });
  });

  it.each(['2026-11-04T15:00:00Z', '2026-11-05T15:00:00Z', 'inválida'])(
    'rejects the proposed date %s',
    (proposedAt) => {
      const input = { ...buildRequest(), proposedAt: new Date(proposedAt) };

      expect(() => Visit.request(input)).toThrow(InvalidProposedVisitDateError);
    },
  );

  it('rejects an invalid request date', () => {
    const input = { ...buildRequest(), requestedAt: new Date(NaN) };

    expect(() => Visit.request(input)).toThrow(InvalidProposedVisitDateError);
  });

  it('rejects the pending visit and normalizes the reason', () => {
    const visit = Visit.request(buildRequest());

    expect(visit.reject('  Horario no disponible.  ')).toBe(
      'Horario no disponible.',
    );
    expect(visit.status).toBe('REJECTED');
    expect(() => visit.reject('Otro motivo.')).toThrow(VisitNotRequestedError);
  });

  it.each(['', ' \t\n', 'a'.repeat(501)])(
    'does not reject a visit when the reason is empty or too long',
    (reason) => {
      const visit = Visit.request(buildRequest());

      expect(() => visit.reject(reason)).toThrow(
        InvalidVisitResolutionReasonError,
      );
      expect(visit.status).toBe('REQUESTED');
    },
  );

  it('does not reject an already scheduled visit', () => {
    const input = buildRequest();
    const visit = Visit.restore({ ...input, status: 'SCHEDULED' });

    expect(() => visit.reject('Horario no disponible.')).toThrow(
      VisitNotRequestedError,
    );
    expect(visit.status).toBe('SCHEDULED');
  });

  it('allows cancelling right before the agreed time', () => {
    const input = buildRequest();
    const visit = Visit.request(input);
    visit.schedule(input.proposedAt, input.requestedAt);

    expect(visit.cancel(new Date(input.proposedAt.getTime() - 1))).toBeNull();
    expect(visit.status).toBe('CANCELLED');
  });

  it.each([0, 1])(
    'blocks cancellation at the start or later (offset %i)',
    (offset) => {
      const input = buildRequest();
      const scheduledStart = input.proposedAt;
      const visit = Visit.restore({
        ...input,
        status: 'SCHEDULED',
        scheduledStart,
      });

      expect(() =>
        visit.cancel(new Date(scheduledStart.getTime() + offset)),
      ).toThrow(VisitCancellationTooLateError);
      expect(visit.status).toBe('SCHEDULED');
    },
  );

  it('does not cancel a pending request', () => {
    const visit = Visit.request(buildRequest());

    expect(() => visit.cancel(new Date())).toThrow(VisitNotScheduledError);
    expect(visit.status).toBe('REQUESTED');
  });

  it('completes when the end time arrives, but not while the slot is still in progress', () => {
    const input = buildRequest();
    const visit = Visit.request(input);
    const { end } = visit.schedule(input.proposedAt, input.requestedAt);

    expect(() => visit.complete(new Date(end.getTime() - 1))).toThrow(
      VisitCompletionTooEarlyError,
    );
    expect(visit.status).toBe('SCHEDULED');

    visit.complete(end);
    expect(visit.status).toBe('COMPLETED');
    expect(() => visit.complete(end)).toThrow(VisitNotScheduledError);
  });

  it.each(['REQUESTED', 'CANCELLED', 'REJECTED'] as const)(
    'does not complete a visit in status %s',
    (status) => {
      const input = buildRequest();
      const visit = Visit.restore({
        ...input,
        status,
        scheduledEnd: input.proposedAt,
      });

      expect(() => visit.complete(input.proposedAt)).toThrow(
        VisitNotScheduledError,
      );
      expect(visit.status).toBe(status);
    },
  );

  it('preserves the proposed date even if the exposed dates are mutated', () => {
    const input = buildRequest();
    const originalDate = input.proposedAt.toISOString();
    const visit = Visit.request(input);

    input.proposedAt.setTime(0);
    visit.proposedAt.setTime(0);

    expect(visit.proposedAt.toISOString()).toBe(originalDate);
  });
});
