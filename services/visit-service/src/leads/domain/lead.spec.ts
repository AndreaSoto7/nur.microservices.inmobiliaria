import {
  InvalidLeadFollowUpNoteError,
  Lead,
  LeadNotOpenError,
} from './lead.js';

describe('Lead', () => {
  const date = new Date('2026-11-05T16:00:00Z');

  it('agrega la nota normalizada a la oportunidad abierta', () => {
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

  it('impide registrar notas cuando la oportunidad está cerrada', () => {
    const lead = new Lead('lead', 'property', 'client', 'agent', 'CLOSED');
    expect(() =>
      lead.registerFollowUp('note', 'Se llamó al cliente.', date),
    ).toThrow(LeadNotOpenError);
  });

  it.each([' \t', 'a'.repeat(2001), 'Nota\0'])(
    'rechaza notas inválidas',
    (note) => {
      const lead = new Lead('lead', 'property', 'client', 'agent', 'OPEN');
      expect(() => lead.registerFollowUp('note', note, date)).toThrow(
        InvalidLeadFollowUpNoteError,
      );
    },
  );
});
