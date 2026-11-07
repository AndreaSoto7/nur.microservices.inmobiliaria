import { InvalidLeadNoteError, Lead, LeadNotOpenError } from './lead.js';

describe('Lead', () => {
  const date = new Date('2026-11-05T16:00:00Z');

  it('adds the normalized note to the open lead', () => {
    const lead = new Lead('lead', 'property', 'client', 'agent', 'OPEN');
    expect(
      lead.registerFollowUp('note', '  Se llamó al cliente.  ', date),
    ).toEqual({
      id: 'note',
      leadId: 'lead',
      agentId: 'agent',
      note: 'Se llamó al cliente.',
      createdAt: date,
    });
  });

  it.each(['WON', 'LOST'] as const)(
    'closes as %s and blocks new follow-ups',
    (outcome) => {
      const lead = new Lead('lead', 'property', 'client', 'agent', 'OPEN');

      expect(lead.close(outcome, date, '  Nota de cierre.  ')).toEqual({
        outcome,
        note: 'Nota de cierre.',
        closedAt: date,
      });
      expect(lead.status).toBe('CLOSED');
      expect(() => lead.close(outcome, date)).toThrow(LeadNotOpenError);
      expect(() => lead.registerFollowUp('note', 'Nueva nota.', date)).toThrow(
        LeadNotOpenError,
      );
    },
  );

  it('keeps the lead open when the closing note is invalid', () => {
    const lead = new Lead('lead', 'property', 'client', 'agent', 'OPEN');
    expect(() => lead.close('WON', date, '  ')).toThrow(InvalidLeadNoteError);
    expect(lead.status).toBe('OPEN');
  });

  it('prevents adding notes when the lead is closed', () => {
    const lead = new Lead('lead', 'property', 'client', 'agent', 'CLOSED');
    expect(() =>
      lead.registerFollowUp('note', 'Se llamó al cliente.', date),
    ).toThrow(LeadNotOpenError);
  });

  it.each([' \t', 'a'.repeat(2001), 'Nota\0'])(
    'rejects invalid notes',
    (note) => {
      const lead = new Lead('lead', 'property', 'client', 'agent', 'OPEN');
      expect(() => lead.registerFollowUp('note', note, date)).toThrow(
        InvalidLeadNoteError,
      );
    },
  );
});
