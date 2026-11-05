type VisitRequest = {
  id: string;
  propertyId: string;
  clientId: string;
  agentId: string;
  proposedAt: Date;
  requestedAt: Date;
};

export class InvalidProposedVisitDateError extends Error {
  constructor() {
    super('La fecha propuesta para la visita debe estar en el futuro.');
  }
}

export class Visit {
  readonly status = 'REQUESTED';

  private constructor(
    readonly id: string,
    readonly propertyId: string,
    readonly clientId: string,
    readonly agentId: string,
    private readonly proposedAtMs: number,
    private readonly requestedAtMs: number,
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
    );
  }

  get proposedAt(): Date {
    return new Date(this.proposedAtMs);
  }

  get requestedAt(): Date {
    return new Date(this.requestedAtMs);
  }
}
