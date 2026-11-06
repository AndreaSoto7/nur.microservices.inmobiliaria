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
export class InvalidVisitRejectionReasonError extends Error {}

export type VisitState = VisitRequest & { status: VisitStatus };

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

  static restore(input: VisitRequest & { status: VisitStatus }): Visit {
    return new Visit(
      input.id,
      input.propertyId,
      input.clientId,
      input.agentId,
      input.proposedAt.getTime(),
      input.requestedAt.getTime(),
      input.status,
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
    return { start: new Date(start.getTime()), end };
  }

  reject(reason: string): string {
    if (this.state !== 'REQUESTED') throw new VisitNotRequestedError();
    const normalizedReason = reason.trim();
    if (
      !normalizedReason ||
      reason.includes('\0') ||
      [...reason].length > 500
    ) {
      throw new InvalidVisitRejectionReasonError();
    }
    this.state = 'REJECTED';
    return normalizedReason;
  }

  get proposedAt(): Date {
    return new Date(this.proposedAtMs);
  }

  get requestedAt(): Date {
    return new Date(this.requestedAtMs);
  }
}
