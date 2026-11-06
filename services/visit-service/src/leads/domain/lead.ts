export type LeadStatus = 'OPEN' | 'CLOSED';
export const leadOutcomes = ['WON', 'LOST'] as const;
export type LeadOutcome = (typeof leadOutcomes)[number];
export type LeadClosure = {
  outcome: LeadOutcome;
  note?: string;
  closedAt: Date;
};

export type LeadSummary = {
  id: string;
  propertyId: string;
  clientId: string;
  status: LeadStatus;
  openedAt: Date;
  closedAt?: Date;
  outcome?: LeadOutcome;
};

export type LeadFollowUpDetails = {
  id: string;
  leadId: string;
  note: string;
  createdAt: Date;
};
export type LeadFollowUp = LeadFollowUpDetails & { agentId: string };

export class LeadNotOpenError extends Error {}
export class InvalidLeadNoteError extends Error {}
export class InvalidLeadOutcomeError extends Error {}

function normalizeNote(note: string): string {
  const normalized = note.trim();
  if (!normalized || note.includes('\0') || [...note].length > 2000) {
    throw new InvalidLeadNoteError();
  }
  return normalized;
}

export class Lead {
  constructor(
    readonly id: string,
    readonly propertyId: string,
    readonly clientId: string,
    readonly agentId: string,
    private state: LeadStatus,
  ) {}

  get status(): LeadStatus {
    return this.state;
  }

  close(outcome: LeadOutcome, closedAt: Date, note?: string): LeadClosure {
    if (this.status !== 'OPEN') throw new LeadNotOpenError();
    if (!leadOutcomes.includes(outcome)) throw new InvalidLeadOutcomeError();
    const normalized = note === undefined ? undefined : normalizeNote(note);
    this.state = 'CLOSED';
    return { outcome, note: normalized, closedAt };
  }

  registerFollowUp(id: string, note: string, createdAt: Date): LeadFollowUp {
    if (this.status !== 'OPEN') throw new LeadNotOpenError();
    const normalized = normalizeNote(note);
    return {
      id,
      leadId: this.id,
      agentId: this.agentId,
      note: normalized,
      createdAt,
    };
  }
}
