type VisitRequest = {
  id: string;
  propertyId: string;
  clientId: string;
  agentId: string;
  proposedAt: Date;
  requestedAt: Date;
};

export type VisitStatus =
  'REQUESTED' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
export type VisitSlot = { start: Date; end: Date };

const visitDurationMs = 60 * 60 * 1000;

export class VisitNotRequestedError extends Error {}
export class InvalidVisitScheduleError extends Error {}
export class InvalidVisitResolutionReasonError extends Error {}
export class VisitNotScheduledError extends Error {}
export class VisitCancellationTooLateError extends Error {}
export class VisitCompletionTooEarlyError extends Error {}

function normalizeResolutionReason(reason: string): string {
  const normalized = reason.trim();
  if (!normalized || reason.includes('\0') || [...reason].length > 500) {
    throw new InvalidVisitResolutionReasonError();
  }
  return normalized;
}

export type VisitState = VisitRequest & {
  status: VisitStatus;
  scheduledStart?: Date | null;
  scheduledEnd?: Date | null;
};

export class InvalidProposedVisitDateError extends Error {
  constructor() {
    super('La fecha propuesta para la visita debe estar en el futuro.');
  }
}

export class Visit {
  private constructor(
    readonly id: string,
    readonly propertyId: string,
    readonly clientId: string,
    readonly agentId: string,
    private readonly proposedAtMs: number,
    private readonly requestedAtMs: number,
    private state: VisitStatus,
    private scheduledStartMs?: number,
    private scheduledEndMs?: number,
  ) {}

  static request(input: VisitRequest): Visit {
    const proposedAt = input.proposedAt.getTime();
    const requestedAt = input.requestedAt.getTime();
    // Invalid dates compare false, just like dates that are not in the future.
    if (!(proposedAt > requestedAt)) {
      throw new InvalidProposedVisitDateError();
    }

    return new Visit(
      input.id,
      input.propertyId,
      input.clientId,
      input.agentId,
      proposedAt,
      requestedAt,
      'REQUESTED',
    );
  }

  static restore(input: VisitState): Visit {
    return new Visit(
      input.id,
      input.propertyId,
      input.clientId,
      input.agentId,
      input.proposedAt.getTime(),
      input.requestedAt.getTime(),
      input.status,
      input.scheduledStart?.getTime(),
      input.scheduledEnd?.getTime(),
    );
  }

  get status(): VisitStatus {
    return this.state;
  }

  schedule(start: Date, now: Date): VisitSlot {
    if (this.state !== 'REQUESTED') throw new VisitNotRequestedError();
    const end = new Date(start.getTime() + visitDurationMs);
    if (!(start.getTime() > now.getTime()) || end.getUTCFullYear() > 9999) {
      throw new InvalidVisitScheduleError();
    }
    this.state = 'SCHEDULED';
    this.scheduledStartMs = start.getTime();
    this.scheduledEndMs = end.getTime();
    return { start: new Date(start.getTime()), end };
  }

  reject(reason: string): string {
    if (this.state !== 'REQUESTED') throw new VisitNotRequestedError();
    const normalizedReason = normalizeResolutionReason(reason);
    this.state = 'REJECTED';
    return normalizedReason;
  }

  cancel(now: Date, reason?: string): string | null {
    if (this.state !== 'SCHEDULED') throw new VisitNotScheduledError();
    if (
      this.scheduledStartMs === undefined ||
      !(now.getTime() < this.scheduledStartMs)
    ) {
      throw new VisitCancellationTooLateError();
    }
    const normalizedReason =
      reason === undefined ? null : normalizeResolutionReason(reason);
    this.state = 'CANCELLED';
    return normalizedReason;
  }

  complete(now: Date): void {
    if (this.state !== 'SCHEDULED') throw new VisitNotScheduledError();
    if (
      this.scheduledEndMs === undefined ||
      !(now.getTime() >= this.scheduledEndMs)
    ) {
      throw new VisitCompletionTooEarlyError();
    }
    this.state = 'COMPLETED';
  }

  get proposedAt(): Date {
    return new Date(this.proposedAtMs);
  }

  get requestedAt(): Date {
    return new Date(this.requestedAtMs);
  }
}
