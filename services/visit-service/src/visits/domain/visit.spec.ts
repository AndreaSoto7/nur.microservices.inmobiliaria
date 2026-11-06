import {
  InvalidProposedVisitDateError,
  InvalidVisitRejectionReasonError,
  Visit,
  VisitNotRequestedError,
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

  it('crea una visita pendiente vinculada por ID a la propiedad', () => {
    const input = buildRequest();

    const visit = Visit.request(input);

    expect(visit).toMatchObject({ ...input, status: 'REQUESTED' });
  });

  it.each(['2026-11-04T15:00:00Z', '2026-11-05T15:00:00Z', 'inválida'])(
    'rechaza la fecha propuesta %s',
    (proposedAt) => {
      const input = { ...buildRequest(), proposedAt: new Date(proposedAt) };

      expect(() => Visit.request(input)).toThrow(InvalidProposedVisitDateError);
    },
  );

  it('rechaza una fecha de solicitud inválida', () => {
    const input = { ...buildRequest(), requestedAt: new Date(NaN) };

    expect(() => Visit.request(input)).toThrow(InvalidProposedVisitDateError);
  });

  it('rechaza la visita pendiente y normaliza el motivo', () => {
    const visit = Visit.request(buildRequest());

    expect(visit.reject('  Horario no disponible.  ')).toBe(
      'Horario no disponible.',
    );
    expect(visit.status).toBe('REJECTED');
    expect(() => visit.reject('Otro motivo.')).toThrow(VisitNotRequestedError);
  });

  it.each(['', ' \t\n', 'a'.repeat(501)])(
    'no rechaza una visita si el motivo está vacío o es demasiado largo',
    (reason) => {
      const visit = Visit.request(buildRequest());

      expect(() => visit.reject(reason)).toThrow(
        InvalidVisitRejectionReasonError,
      );
      expect(visit.status).toBe('REQUESTED');
    },
  );

  it('no rechaza una visita ya programada', () => {
    const input = buildRequest();
    const visit = Visit.restore({ ...input, status: 'SCHEDULED' });

    expect(() => visit.reject('Horario no disponible.')).toThrow(
      VisitNotRequestedError,
    );
    expect(visit.status).toBe('SCHEDULED');
  });

  it('preserva la fecha propuesta aunque se muten las fechas expuestas', () => {
    const input = buildRequest();
    const originalDate = input.proposedAt.toISOString();
    const visit = Visit.request(input);

    input.proposedAt.setTime(0);
    visit.proposedAt.setTime(0);

    expect(visit.proposedAt.toISOString()).toBe(originalDate);
  });
});
