import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { VisitProblem } from '../shared/visit-problem.js';
import { CancelVisitCommand } from '../visits/application/cancel-visit.js';
import { RejectVisitCommand } from '../visits/application/reject-visit.js';
import {
  VISIT_REPOSITORY,
  type PropertyPolicySource,
  type VisitRepository,
} from '../visits/domain/visit.repository.js';
import type { PropertyEvent } from './property-event.js';

const policyStatuses = {
  PropertyReserved: 'RESERVED',
  PropertySold: 'SOLD',
  PropertyRented: 'RENTED',
} as const;

export function propertyPolicySource(
  event: PropertyEvent,
): PropertyPolicySource | undefined {
  if (
    event.type !== 'PropertyReserved' &&
    event.type !== 'PropertySold' &&
    event.type !== 'PropertyRented'
  ) {
    return;
  }
  return {
    actor: 'SYSTEM',
    eventId: event.eventId,
    propertyId: event.propertyId,
    status: policyStatuses[event.type],
    occurredAt: event.occurredAt,
  };
}

@Injectable()
export class PropertyVisitPolicy {
  private readonly logger = new Logger(PropertyVisitPolicy.name);

  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visits: VisitRepository,
    private readonly commands: CommandBus,
  ) {}

  async apply(
    source: PropertyPolicySource,
    correlationId: string,
    heartbeat?: () => Promise<void>,
  ): Promise<void> {
    const reason =
      source.status === 'RESERVED'
        ? 'PROPERTY_RESERVED'
        : 'PROPERTY_UNAVAILABLE';
    // Rejections go first so a pending visit scheduled concurrently is picked up in the cancellation pass.
    await this.process(source, 'REQUESTED', correlationId, reason, heartbeat);
    if (source.status !== 'RESERVED') {
      await this.process(source, 'SCHEDULED', correlationId, reason, heartbeat);
    }
  }

  private async process(
    source: PropertyPolicySource,
    status: 'REQUESTED' | 'SCHEDULED',
    correlationId: string,
    reason: string,
    heartbeat?: () => Promise<void>,
  ): Promise<void> {
    let after: string | undefined;
    for (;;) {
      const ids = await this.visits.listPolicyVisitIds(source, status, after);
      if (ids.length === 0) return;
      for (const id of ids) {
        try {
          if (status === 'REQUESTED') {
            await this.commands.execute(
              new RejectVisitCommand(id, source, reason, correlationId),
            );
          } else {
            await this.commands.execute(
              new CancelVisitCommand(id, source, reason, correlationId),
            );
          }
        } catch (error) {
          if (
            !(error instanceof VisitProblem) ||
            (error.code !== 'VISIT_NOT_REQUESTED' &&
              error.code !== 'VISIT_NOT_SCHEDULED' &&
              error.code !== 'VISIT_CANCELLATION_TOO_LATE')
          ) {
            throw error;
          }
          this.logger.warn({
            eventId: source.eventId,
            visitId: id,
            code: error.code,
          });
        }
        await heartbeat?.();
      }
      after = ids[ids.length - 1];
    }
  }
}
