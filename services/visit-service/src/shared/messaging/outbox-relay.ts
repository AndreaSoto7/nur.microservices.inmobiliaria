import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import { Kafka, type Producer } from 'kafkajs';
import { VisitDatabase } from '../../database/visit-database.js';

type OutboxRow = {
  id: string;
  topic: string;
  aggregate_id: string;
  envelope: Record<string, unknown>;
};

@Injectable()
export class OutboxRelay implements BeforeApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private active?: Promise<void>;
  private stopping = false;

  constructor(private readonly database: VisitDatabase) {}

  start(brokers: string[]): void {
    if (this.active || this.stopping) return;
    const producer = new Kafka({
      clientId: 'visit-outbox',
      brokers,
      connectionTimeout: 2000,
      requestTimeout: 4000,
      retry: { retries: 2, maxRetryTime: 2000 },
    }).producer({
      allowAutoTopicCreation: false,
      idempotent: true,
      maxInFlightRequests: 1,
      retry: { retries: 2, maxRetryTime: 2000 },
    });
    this.active = this.poll(producer);
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    clearTimeout(this.timer);
    await this.active;
  }

  private async poll(producer: Producer): Promise<void> {
    try {
      await this.publishPending(producer);
    } catch (error) {
      this.logger.warn({
        message:
          'Falló el envío de outbox. Los eventos pendientes se reintentarán.',
        errorType: error instanceof Error ? error.name : typeof error,
      });
    } finally {
      await producer.disconnect().catch((error: unknown) => {
        this.logger.warn({
          message: 'No se pudo cerrar el productor de outbox',
          errorType: error instanceof Error ? error.name : typeof error,
        });
      });
      if (!this.stopping) {
        this.timer = setTimeout(() => {
          this.active = this.poll(producer);
        }, 1000);
      }
    }
  }

  private async publishPending(producer: Producer): Promise<void> {
    const database = await this.database.connect();
    const connection = database.createQueryRunner();
    try {
      // A session lock serializes relays without keeping a SQL transaction open during Kafka IO.
      const [{ locked }] = (await connection.query(
        'SELECT pg_try_advisory_lock(118, 1) AS locked',
      )) as { locked: boolean }[];
      if (!locked) return;

      try {
        const pending = (await connection.query(
          `SELECT id, topic, aggregate_id, envelope
             FROM outbox WHERE published_at IS NULL
             ORDER BY created_at, id LIMIT 25`,
        )) as OutboxRow[];
        if (pending.length === 0 || this.stopping) return;

        await producer.connect();
        for (const row of pending) {
          if (this.stopping) break;
          await producer.send({
            topic: row.topic,
            acks: -1,
            timeout: 4000,
            messages: [
              { key: row.aggregate_id, value: JSON.stringify(row.envelope) },
            ],
          });
          await connection.query(
            'UPDATE outbox SET published_at = clock_timestamp() WHERE id = $1',
            [row.id],
          );
        }
      } finally {
        await connection.query('SELECT pg_advisory_unlock(118, 1)');
      }
    } finally {
      await connection.release();
    }
  }
}
