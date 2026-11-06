export type LeadStatus = 'OPEN' | 'CLOSED';

export type LeadSummary = {
  id: string;
  propertyId: string;
  clientId: string;
  status: LeadStatus;
  openedAt: Date;
  closedAt?: Date;
  outcome?: 'WON' | 'LOST';
};

export type LeadFollowUpDetails = {
  id: string;
  leadId: string;
  note: string;
  createdAt: Date;
};
export type LeadFollowUp = LeadFollowUpDetails & { agentId: string };

export class LeadNotOpenError extends Error {}
export class InvalidLeadFollowUpNoteError extends Error {}

export class Lead {
  constructor(
    readonly id: string,
    readonly propertyId: string,
    readonly clientId: string,
    readonly agentId: string,
    readonly status: LeadStatus,
  ) {}

  registerFollowUp(id: string, note: string, createdAt: Date): LeadFollowUp {
    if (this.status !== 'OPEN') throw new LeadNotOpenError();
    const normalized = note.trim();
    if (!normalized || note.includes('\0') || [...note].length > 2000) {
      throw new InvalidLeadFollowUpNoteError();
    }
    return {
      id,
      leadId: this.id,
      agentId: this.agentId,
      note: normalized,
      createdAt,
    };
  }
}
