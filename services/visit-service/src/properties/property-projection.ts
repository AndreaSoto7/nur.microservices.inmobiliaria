import { Injectable } from '@nestjs/common';
import { VisitDatabase } from '../database/visit-database.js';
import type { PropertyEvent } from './property-event.js';

@Injectable()
export class PropertyProjection {
  constructor(private readonly database: VisitDatabase) {}

  async apply(event: PropertyEvent): Promise<void> {
    const database = await this.database.connect();
    await database.transaction(async (manager) => {
      const claimed = await manager.query<{ event_id: string }[]>(
        `INSERT INTO processed_events (event_id, event_type)
         VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
        [event.eventId, event.type],
      );
      if (!claimed.length) return;

      const fields = [
        event.propertyId,
        event.agentId,
        event.status,
        event.occurredAt,
      ];
      if (event.details) {
        await manager.query(
          `INSERT INTO property_snapshots
              (property_id, agent_id, status, last_event_at, title, zone, operation_type, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,now())
            ON CONFLICT (property_id) DO UPDATE SET
              agent_id = EXCLUDED.agent_id, status = EXCLUDED.status,
              last_event_at = EXCLUDED.last_event_at, title = EXCLUDED.title,
              zone = EXCLUDED.zone, operation_type = EXCLUDED.operation_type, updated_at = now()
            WHERE property_snapshots.last_event_at < EXCLUDED.last_event_at`,
          [
            ...fields,
            event.details.title,
            event.details.zone,
            event.details.operationType,
          ],
        );
        return;
      }

      const [snapshot] = await manager.query<{ present: boolean }[]>(
        `WITH applied AS (
           UPDATE property_snapshots SET agent_id = $2, status = $3,
             last_event_at = $4, updated_at = now()
           WHERE property_id = $1 AND last_event_at < $4 RETURNING property_id
         )
         SELECT EXISTS (SELECT 1 FROM applied)
             OR EXISTS (SELECT 1 FROM property_snapshots WHERE property_id = $1) AS present`,
        fields,
      );
      if (!snapshot.present)
        throw new Error('La propiedad aún no tiene una copia local');
    });
  }
}
