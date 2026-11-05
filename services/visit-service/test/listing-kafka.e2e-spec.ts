import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kafka, logLevel, type Producer } from 'kafkajs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { createDataSource } from '../src/database/create-data-source.js';
import { listingPropertyTopic as topic } from '../src/properties/listing-events.controller.js';
import { connectListingConsumer } from '../src/properties/listing-kafka.js';
import { OutboxRelay } from '../src/shared/messaging/outbox-relay.js';

const broker = process.env.VISIT_TEST_KAFKA_BROKER;
const databaseUrl = process.env.VISIT_TEST_DATABASE_URL;
const integration = broker && databaseUrl ? describe : describe.skip;

integration('Listing → Kafka → Visit', () => {
  let app: INestApplication;
  let producer: Producer;
  let database: DataSource;
  const previousUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    if (!broker || !databaseUrl)
      throw new Error('Falta configurar la infraestructura de prueba');
    process.env.DATABASE_URL = databaseUrl;
    database = await createDataSource(databaseUrl).initialize();
    await database.runMigrations();
    const kafka = new Kafka({ brokers: [broker], logLevel: logLevel.NOTHING });
    const admin = kafka.admin();
    await admin.connect();
    try {
      await admin.createTopics({
        topics: [
          { topic },
          { topic: topic + '.dlq' },
          { topic: 'visit.visit.events' },
        ],
      });
    } finally {
      await admin.disconnect();
    }
    producer = kafka.producer();
    await producer.connect();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    connectListingConsumer(app, [broker]);
    await app.startAllMicroservices();
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await producer?.disconnect();
    if (database?.isInitialized) await database.destroy();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  it('actualiza el estado local y conserva el evento más reciente aunque Kafka reentregue mensajes', async () => {
    const propertyId = randomUUID();
    const agentId = randomUUID();
    const common = { propertyId, agentId };
    const event = (eventType: string, second: number, payload: object) => ({
      eventId: randomUUID(),
      eventType,
      eventVersion: 1,
      aggregateId: propertyId,
      aggregateType: 'Property',
      producer: 'listing-service',
      occurredAt: new Date(Date.UTC(2026, 10, 5, 17, 0, second)).toISOString(),
      correlationId: randomUUID(),
      payload: { ...common, ...payload },
    });
    const details = {
      title: 'Casa',
      location: { zone: 'Centro' },
      operationType: 'SALE',
    };
    const published = event('PropertyPublished', 1, {
      ...details,
      status: 'PUBLISHED',
    });
    const reserved = event('PropertyReserved', 3, {
      status: 'RESERVED',
      actor: 'AGENT',
    });
    const stale = event('PropertyPaused', 2, { status: 'PAUSED' });
    const edit = event('PropertyUpdated', 4, {
      ...details,
      title: 'Casa editada',
      status: 'RESERVED',
    });
    const wrongVersion = {
      ...event('PropertySold', 5, { status: 'SOLD' }),
      eventVersion: 2,
    };
    const checkpoint = event('PropertyPaused', 6, { status: 'PAUSED' });
    // A stale event with a different title must not overwrite the current projection.
    const staleEdit = event('PropertyUpdated', 2, {
      ...details,
      title: 'Casa antigua',
      status: 'PUBLISHED',
    });
    await producer.send({
      topic,
      messages: [
        published,
        reserved,
        reserved,
        stale,
        edit,
        wrongVersion,
        staleEdit,
        checkpoint,
      ].map((value) => ({
        key: propertyId,
        value: JSON.stringify(value),
      })),
    });

    const deadline = Date.now() + 12_000;
    let snapshot:
      { title: string; status: string; agentId: string } | undefined;
    do {
      [snapshot] = await database.query<(typeof snapshot)[]>(
        'SELECT title, status, agent_id AS "agentId" FROM property_snapshots WHERE property_id = $1',
        [propertyId],
      );
      if (snapshot?.status === 'PAUSED') break;
      await delay(100);
    } while (Date.now() < deadline);
    expect(snapshot).toEqual({
      title: 'Casa editada',
      status: 'PAUSED',
      agentId,
    });
    const rows = await database.query<{ event_id: string }[]>(
      'SELECT event_id FROM processed_events WHERE event_id = ANY($1::uuid[])',
      [
        [
          published,
          reserved,
          stale,
          edit,
          wrongVersion,
          staleEdit,
          checkpoint,
        ].map((record) => record.eventId),
      ],
    );
    expect(new Set(rows.map((row) => row.event_id))).toEqual(
      new Set(
        [published, reserved, stale, edit, staleEdit, checkpoint].map(
          (record) => record.eventId,
        ),
      ),
    );
  }, 15_000);

  it('publica las filas pendientes con su clave y registra la confirmación de Kafka', async () => {
    if (!broker) throw new Error('Falta Kafka de prueba');
    const eventId = randomUUID();
    const visitId = randomUUID();
    const eventTopic = 'visit.visit.events';
    const envelope = {
      eventId,
      eventType: 'VisitRequested',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producer: 'visit-service',
      aggregateType: 'Visit',
      aggregateId: visitId,
      correlationId: randomUUID(),
      payload: {
        visitId,
        propertyId: randomUUID(),
        clientId: randomUUID(),
        agentId: randomUUID(),
        proposedAt: new Date(Date.now() + 86400000).toISOString(),
      },
    };
    const consumer = new Kafka({
      brokers: [broker],
      logLevel: logLevel.NOTHING,
    }).consumer({
      groupId: 'visit-outbox-test-' + randomUUID(),
    });
    const received: { key: string | undefined; value: string | undefined }[] =
      [];
    await consumer.connect();
    try {
      await consumer.subscribe({ topics: [eventTopic], fromBeginning: true });
      await consumer.run({
        eachMessage: async ({ message }) => {
          received.push({
            key: message.key?.toString(),
            value: message.value?.toString(),
          });
        },
      });
      await database.query(
        'INSERT INTO outbox (id, topic, aggregate_id, envelope) VALUES ($1,$2,$3,$4)',
        [eventId, eventTopic, visitId, envelope],
      );
      app.get(OutboxRelay).start([broker]);
      const deadline = Date.now() + 10000;
      let published: Date | null = null;
      do {
        const [row] = await database.query<{ published_at: Date | null }[]>(
          'SELECT published_at FROM outbox WHERE id = $1',
          [eventId],
        );
        published = row.published_at;
        if (published && received.length > 0) break;
        await delay(100);
      } while (Date.now() < deadline);

      expect(published).toBeInstanceOf(Date);
      expect(received).toEqual([{ key: visitId, value: expect.any(String) }]);
      expect(JSON.parse(received[0].value!)).toEqual(envelope);
    } finally {
      await consumer.disconnect();
    }
  }, 15000);
});
