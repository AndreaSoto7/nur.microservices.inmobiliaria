import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { createDataSource } from '../src/database/create-data-source.js';

const databaseUrl = process.env.VISIT_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres('Solicitudes de visita en PostgreSQL', () => {
  const propertyId = randomUUID();
  const pausedPropertyId = randomUUID();
  const inquiryPropertyId = randomUUID();
  const inboxPropertyId = randomUUID();
  const propertyIds = [
    propertyId,
    pausedPropertyId,
    inquiryPropertyId,
    inboxPropertyId,
  ];
  const clientId = randomUUID();
  const agentId = randomUUID();
  const otherAgentId = randomUUID();
  const otherClientId = randomUUID();
  const path = '/api/v1/visits';
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousJwksUrl = process.env.JWT_JWKS_URL;
  const body = {
    propertyId,
    proposedAt: new Date(Date.now() + 86_400_000).toISOString(),
    clientNote: 'Después del mediodía',
  };
  let app: INestApplication<App>;
  let database: DataSource;
  let jwks: Server;
  let clientToken: string;
  let agentToken: string;
  let otherToken: string;
  let otherAgentToken: string;

  beforeAll(async () => {
    database = await createDataSource(databaseUrl!).initialize();
    await database.runMigrations();
    await database.query(
      `INSERT INTO property_snapshots
        (property_id, agent_id, title, zone, operation_type, status, last_event_at, updated_at)
       VALUES ($1,$2,'Casa','Centro','SALE','PUBLISHED',now(),now()),
              ($3,$2,'Casa','Centro','SALE','PAUSED',now(),now()),
              ($4,$2,'Casa','Centro','SALE','PUBLISHED',now(),now())`,
      [propertyId, agentId, pausedPropertyId, inquiryPropertyId],
    );

    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const key = {
      ...(await exportJWK(publicKey)),
      kid: 'visit-test',
      alg: 'RS256',
    };
    jwks = createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ keys: [key] }));
    }).listen(0, '127.0.0.1');
    await once(jwks, 'listening');
    const address = jwks.address();
    if (!address || typeof address === 'string')
      throw new Error('No hay puerto para JWKS');
    process.env.JWT_JWKS_URL = `http://127.0.0.1:${address.port}/jwks.json`;
    process.env.DATABASE_URL = databaseUrl;

    const token = (id: string, role: string) =>
      new SignJWT({ roles: [role] })
        .setProtectedHeader({ alg: 'RS256', typ: 'at+jwt', kid: key.kid })
        .setSubject(id)
        .setIssuer('identity-service')
        .setAudience('inmobiliaria')
        .setExpirationTime('5m')
        .sign(privateKey);
    [clientToken, agentToken, otherToken, otherAgentToken] = await Promise.all([
      token(clientId, 'CLIENT'),
      token(agentId, 'AGENT'),
      token(otherClientId, 'CLIENT'),
      token(otherAgentId, 'AGENT'),
    ]);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  }, 15_000);

  afterAll(async () => {
    await app?.close();
    if (jwks) await new Promise<void>((resolve) => jwks.close(() => resolve()));
    if (database?.isInitialized) {
      await database.transaction(async (manager) => {
        await manager.query(
          "DELETE FROM outbox WHERE envelope->'payload'->>'propertyId' = ANY($1::text[])",
          [propertyIds],
        );
        await manager.query(
          'DELETE FROM idempotency_records WHERE client_id IN ($1,$2)',
          [clientId, agentId],
        );
        await manager.query(
          'DELETE FROM inquiries WHERE property_id = ANY($1::uuid[])',
          [propertyIds],
        );
        await manager.query(
          'DELETE FROM visits WHERE property_id = ANY($1::uuid[])',
          [propertyIds],
        );
        await manager.query(
          'DELETE FROM leads WHERE property_id = ANY($1::uuid[])',
          [propertyIds],
        );
        await manager.query(
          'DELETE FROM property_snapshots WHERE property_id = ANY($1::uuid[])',
          [propertyIds],
        );
      });
      await database.destroy();
    }
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousJwksUrl === undefined) delete process.env.JWT_JWKS_URL;
    else process.env.JWT_JWKS_URL = previousJwksUrl;
  });

  it('crea una sola visita y oportunidad, repite el resultado y protege su lectura', async () => {
    const key = randomUUID();
    const http = request(app.getHttpServer());
    const create = (payload: unknown, requestKey = key) =>
      http
        .post(path)
        .auth(clientToken, { type: 'bearer' })
        .set('Idempotency-Key', requestKey)
        .set('X-Correlation-Id', 'visit-test')
        .send(payload as object);
    const [first, replay] = await Promise.all([
      create(body).expect(201),
      create({
        clientNote: body.clientNote,
        proposedAt: body.proposedAt,
        propertyId,
      }).expect(201),
    ]);
    const created = first.body as { id: string };
    const location = path + '/' + created.id;
    expect(replay.body).toEqual(created);
    expect(first.headers.location).toBe(location);
    expect(replay.headers.location).toBe(location);
    await create({ ...body, clientNote: 'otro' })
      .expect(422)
      .expect(/IDEMPOTENCY_KEY_REUSED/);
    await create(body, randomUUID())
      .expect(409)
      .expect(/VISIT_ALREADY_REQUESTED/);
    for (const token of [clientToken, agentToken]) {
      const detail = await http
        .get(location)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(detail.body).toMatchObject({
        id: created.id,
        propertyId,
        status: 'REQUESTED',
      });
    }
    await http
      .get(location)
      .auth(otherToken, { type: 'bearer' })
      .expect(404)
      .expect(/VISIT_NOT_FOUND/);
    const events = await database.query<
      { type: string; correlationId: string }[]
    >(
      `SELECT envelope->>'eventType' AS type, envelope->>'correlationId' AS "correlationId"
         FROM outbox WHERE envelope->'payload'->>'propertyId' = $1 ORDER BY type`,
      [propertyId],
    );
    expect(events).toEqual([
      { type: 'LeadOpened', correlationId: 'visit-test' },
      { type: 'VisitRequested', correlationId: 'visit-test' },
    ]);
  });

  it('programa una sola solicitud en un horario disputado y permite una visita consecutiva', async () => {
    const ids = [randomUUID(), randomUUID()];
    for (const id of ids) {
      await database.query(
        `INSERT INTO visits (id, property_id, client_id, agent_id, status, proposed_at, requested_at, updated_at)
          VALUES ($1,$2,$3,$4,'REQUESTED',$5,now(),now())`,
        [id, propertyId, randomUUID(), agentId, body.proposedAt],
      );
    }

    const http = request(app.getHttpServer());
    const start = new Date(Date.now() + 48 * 3600_000);
    const scheduledStart = start.toISOString();
    const scheduledEnd = new Date(start.getTime() + 3600_000).toISOString();
    const schedule = (
      id: string,
      key: string,
      token = agentToken,
      date = scheduledStart,
    ) =>
      http
        .post(path + '/' + id + '/schedule')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .set('X-Correlation-Id', 'schedule-test')
        .send({ scheduledStart: date });
    await schedule(ids[0], randomUUID(), clientToken).expect(403);
    await schedule(ids[0], randomUUID(), otherAgentToken).expect(404);
    await schedule(ids[0], randomUUID(), agentToken, '2020-01-01T00:00:00Z')
      .expect(409)
      .expect(/VISIT_INVALID_SCHEDULE/);

    const keys = [randomUUID(), randomUUID()];
    const results = await Promise.all(
      ids.map((id, index) => schedule(id, keys[index])),
    );
    expect(results.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const winner = results.findIndex((response) => response.status === 200);
    const loser = 1 - winner;
    expect(results[loser].body).toMatchObject({
      code: 'VISIT_SCHEDULE_CONFLICT',
    });
    const id = ids[winner];
    const expected = { id, status: 'SCHEDULED', scheduledStart, scheduledEnd };
    expect(results[winner].body).toEqual(expected);
    expect((await schedule(id, keys[winner]).expect(200)).body).toEqual(
      expected,
    );
    await schedule(id, keys[winner], agentToken, scheduledEnd).expect(422);
    await schedule(id, randomUUID())
      .expect(409)
      .expect(/VISIT_NOT_REQUESTED/);
    await schedule(ids[loser], keys[loser], agentToken, scheduledEnd).expect(
      200,
    );
    const detail = await http
      .get(path + '/' + id)
      .auth(agentToken, { type: 'bearer' })
      .expect(200);
    expect(detail.body).toMatchObject(expected);

    const events = await database.query<
      { topic: string; envelope: Record<string, unknown> }[]
    >(
      "SELECT topic, envelope FROM outbox WHERE aggregate_id = $1 AND envelope->>'eventType' = 'VisitScheduled'",
      [id],
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      topic: 'visit.visit.events',
      envelope: {
        aggregateId: id,
        aggregateType: 'Visit',
        correlationId: 'schedule-test',
        payload: {
          visitId: id,
          propertyId,
          agentId,
          scheduledStart,
          scheduledEnd,
        },
      },
    });
    const schemaPath = new URL(
      '../../../contracts/events/visit/visit-scheduled.v1.schema.json',
      import.meta.url,
    );
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const validator = addFormats.default(new Ajv2020());
    expect(validator.validate(schema, events[0].envelope.payload)).toBe(true);
  });

  it('rechaza una visita pendiente una sola vez y deja el motivo visible al cliente', async () => {
    const id = randomUUID();
    const visitPropertyId = pausedPropertyId;
    await database.query(
      `INSERT INTO visits (id, property_id, client_id, agent_id, status, proposed_at, requested_at, updated_at)
       VALUES ($1,$2,$3,$4,'REQUESTED',$5,now(),now())`,
      [id, visitPropertyId, clientId, agentId, body.proposedAt],
    );

    const http = request(app.getHttpServer());
    const location = path + '/' + id;
    const reason = 'Horario no disponible.';
    const reject = (
      key: string,
      payload: object = { reason: '  ' + reason + ' ' },
      token: string | null = agentToken,
    ) => {
      const action = http
        .post(location + '/reject')
        .set('Idempotency-Key', key)
        .set('X-Correlation-Id', 'reject-test');
      if (token) action.auth(token, { type: 'bearer' });
      return action.send(payload);
    };
    await reject(randomUUID(), { reason }, null).expect(401);
    await reject(randomUUID(), { reason }, clientToken).expect(403);
    await reject(randomUUID(), { reason }, otherAgentToken)
      .expect(404)
      .expect(/VISIT_NOT_FOUND/);
    await reject(randomUUID(), {}).expect(400);
    await reject(randomUUID(), { reason: '   ' }).expect(400);
    await reject(randomUUID(), { reason: 'No disponible\0' }).expect(400);
    await reject(randomUUID(), { reason, actor: 'SYSTEM' }).expect(400);
    await reject('not-a-uuid').expect(400);

    const key = randomUUID();
    const [accepted, replay] = await Promise.all([
      reject(key).expect(200).expect('X-Correlation-Id', 'reject-test'),
      reject(key).expect(200),
    ]);
    expect(accepted.body).toEqual({ id, status: 'REJECTED' });
    expect(replay.body).toEqual(accepted.body);
    await reject(key, { reason: 'Otro motivo.' }).expect(422);
    await reject(randomUUID())
      .expect(409)
      .expect(/VISIT_NOT_REQUESTED/);

    const [row] = await database.query<
      {
        status: string;
        resolvedBy: string;
        resolvedAt: Date;
        version: number;
      }[]
    >(
      `SELECT status, resolved_by AS "resolvedBy", resolved_at AS "resolvedAt", version::integer
       FROM visits WHERE id = $1`,
      [id],
    );
    expect(row).toMatchObject({
      status: 'REJECTED',
      resolvedBy: 'AGENT',
      resolvedAt: expect.any(Date),
      version: 1,
    });
    const detail = await http
      .get(location)
      .auth(clientToken, { type: 'bearer' })
      .expect(200);
    expect(detail.body).toMatchObject({
      status: 'REJECTED',
      resolutionReason: reason,
    });
    await http.get(location).auth(otherToken, { type: 'bearer' }).expect(404);

    const events = await database.query<
      { topic: string; envelope: { payload: unknown } }[]
    >(
      "SELECT topic, envelope FROM outbox WHERE aggregate_id = $1 AND envelope->>'eventType' = 'VisitRejected'",
      [id],
    );
    expect(events).toEqual([
      {
        topic: 'visit.visit.events',
        envelope: expect.objectContaining({
          aggregateId: id,
          correlationId: 'reject-test',
          payload: {
            visitId: id,
            propertyId: visitPropertyId,
            clientId,
            agentId,
            actor: 'AGENT',
            reason,
          },
        }),
      },
    ]);
    const schemaPath = new URL(
      '../../../contracts/events/visit/visit-rejected.v1.schema.json',
      import.meta.url,
    );
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const validator = addFormats.default(new Ajv2020());
    expect(validator.validate(schema, events[0].envelope.payload)).toBe(true);
  });

  it('permite cancelar a los participantes, libera el horario y registra un evento por visita', async () => {
    const start = new Date(Date.now() + 96 * 3600_000);
    const otherStart = new Date(start.getTime() + 3 * 3600_000);
    const past = new Date(Date.now() - 1000);
    const insertScheduled = async (date: Date) => {
      const id = randomUUID();
      await database.query(
        `INSERT INTO visits
          (id, property_id, client_id, agent_id, status, proposed_at, requested_at,
           updated_at, scheduled_start, scheduled_end)
         VALUES ($1,$2,$3,$4,'SCHEDULED',$5,now(),now(),$6,$7)`,
        [
          id,
          propertyId,
          clientId,
          agentId,
          body.proposedAt,
          date,
          new Date(date.getTime() + 3600_000),
        ],
      );
      return id;
    };
    const clientVisit = await insertScheduled(start);
    const agentVisit = await insertScheduled(otherStart);
    const pastVisit = await insertScheduled(past);
    const pendingVisit = randomUUID();
    await database.query(
      `INSERT INTO visits (id, property_id, client_id, agent_id, status, proposed_at, requested_at, updated_at)
       VALUES ($1,$2,$3,$4,'REQUESTED',$5,now(),now())`,
      [pendingVisit, propertyId, randomUUID(), agentId, body.proposedAt],
    );

    const http = request(app.getHttpServer());
    const cancel = (id: string, token: string | null, key = randomUUID()) => {
      const action = http
        .post(path + '/' + id + '/cancel')
        .set('Idempotency-Key', key)
        .set('X-Correlation-Id', 'cancel-test');
      return token ? action.auth(token, { type: 'bearer' }) : action;
    };
    await cancel(clientVisit, null).expect(401);
    await cancel(clientVisit, otherToken).expect(404);
    await cancel(clientVisit, otherAgentToken).expect(404);
    await cancel(clientVisit, clientToken).send([]).expect(400);
    await cancel(clientVisit, clientToken).send({ reason: null }).expect(400);
    await cancel(clientVisit, clientToken).send({ reason: '  ' }).expect(400);
    await cancel(clientVisit, clientToken)
      .send({ actor: 'SYSTEM' })
      .expect(400);
    await cancel(pendingVisit, agentToken)
      .expect(409)
      .expect(/VISIT_NOT_SCHEDULED/);
    await cancel(pastVisit, clientToken)
      .expect(409)
      .expect(/VISIT_CANCELLATION_TOO_LATE/);

    const key = randomUUID();
    const expected = { id: clientVisit, status: 'CANCELLED' };
    await Promise.all([
      cancel(clientVisit, clientToken, key).expect(200, expected),
      cancel(clientVisit, clientToken, key).send({}).expect(200, expected),
    ]);
    await cancel(clientVisit, clientToken, key)
      .send({ reason: 'Cambio' })
      .expect(422);
    await cancel(clientVisit, agentToken)
      .expect(409)
      .expect(/VISIT_NOT_SCHEDULED/);
    const reason = 'No puedo atender la visita.';
    await cancel(agentVisit, agentToken)
      .send({ reason: '  ' + reason + ' ' })
      .expect(200, { id: agentVisit, status: 'CANCELLED' });

    const detail = await http
      .get(path + '/' + agentVisit)
      .auth(clientToken, { type: 'bearer' })
      .expect(200);
    expect(detail.body).toMatchObject({
      status: 'CANCELLED',
      scheduledStart: otherStart.toISOString(),
      resolutionReason: reason,
    });
    await http
      .post(path + '/' + pendingVisit + '/schedule')
      .auth(agentToken, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ scheduledStart: start.toISOString() })
      .expect(200);

    const events = await database.query<
      { topic: string; envelope: { payload: unknown } }[]
    >(
      "SELECT topic, envelope FROM outbox WHERE aggregate_id IN ($1,$2) AND envelope->>'eventType' = 'VisitCancelled' ORDER BY envelope->'payload'->>'actor'",
      [clientVisit, agentVisit],
    );
    expect(events).toEqual([
      {
        topic: 'visit.visit.events',
        envelope: expect.objectContaining({
          correlationId: 'cancel-test',
          payload: {
            visitId: agentVisit,
            propertyId,
            clientId,
            agentId,
            actor: 'AGENT',
            reason,
          },
        }),
      },
      {
        topic: 'visit.visit.events',
        envelope: expect.objectContaining({
          correlationId: 'cancel-test',
          payload: {
            visitId: clientVisit,
            propertyId,
            clientId,
            agentId,
            actor: 'CLIENT',
            reason: null,
          },
        }),
      },
    ]);
    const schemaPath = new URL(
      '../../../contracts/events/visit/visit-cancelled.v1.schema.json',
      import.meta.url,
    );
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const validate = addFormats.default(new Ajv2020()).compile(schema);
    expect(events.every(({ envelope }) => validate(envelope.payload))).toBe(
      true,
    );
  });

  it('completa solo una visita del agente cuyo horario terminó y registra la hora una vez', async () => {
    const pastEnd = new Date(Date.now() - 2 * 3600_000);
    const futureEnd = new Date(Date.now() + 7 * 86_400_000);
    const ids = [randomUUID(), randomUUID()];
    for (const [index, end] of [pastEnd, futureEnd].entries()) {
      await database.query(
        `INSERT INTO visits
          (id, property_id, client_id, agent_id, status, proposed_at, requested_at,
           updated_at, scheduled_start, scheduled_end)
         VALUES ($1,$2,$3,$4,'SCHEDULED',$5,now(),now(),$6,$7)`,
        [
          ids[index],
          propertyId,
          clientId,
          agentId,
          body.proposedAt,
          new Date(end.getTime() - 3600_000),
          end,
        ],
      );
    }

    const http = request(app.getHttpServer());
    const [eligible, future] = ids;
    const complete = (
      id: string,
      token: string | null,
      key: string = randomUUID(),
    ) => {
      const action = http
        .post(path + '/' + id + '/complete')
        .set('Idempotency-Key', key)
        .set('X-Correlation-Id', 'complete-test');
      return token ? action.auth(token, { type: 'bearer' }) : action;
    };
    await complete(eligible, null).expect(401);
    await complete(eligible, clientToken).expect(403);
    await complete(eligible, otherAgentToken).expect(404);
    await complete(eligible, agentToken, 'not-a-uuid').expect(400);
    await complete(eligible, agentToken)
      .send({ completedAt: body.proposedAt })
      .expect(400);
    await complete(future, agentToken)
      .expect(409)
      .expect(/VISIT_COMPLETION_TOO_EARLY/);

    const key = randomUUID();
    const expected = { id: eligible, status: 'COMPLETED' };
    await Promise.all([
      complete(eligible, agentToken, key).expect(200, expected),
      complete(eligible, agentToken, key).send({}).expect(200, expected),
    ]);
    await complete(future, agentToken, key).expect(422);
    await complete(eligible, agentToken)
      .expect(409)
      .expect(/VISIT_NOT_SCHEDULED/);

    const detail = await http
      .get(path + '/' + eligible)
      .auth(clientToken, { type: 'bearer' })
      .expect(200);
    const { completedAt } = detail.body as { completedAt: string };
    expect(new Date(completedAt).getTime()).toBeGreaterThan(pastEnd.getTime());
    expect(detail.body).toMatchObject({
      status: 'COMPLETED',
      scheduledEnd: pastEnd.toISOString(),
    });
    const events = await database.query<
      { topic: string; envelope: { payload: unknown } }[]
    >(
      "SELECT topic, envelope FROM outbox WHERE aggregate_id IN ($1,$2) AND envelope->>'eventType' = 'VisitCompleted'",
      ids,
    );
    expect(events).toEqual([
      {
        topic: 'visit.visit.events',
        envelope: expect.objectContaining({
          aggregateId: eligible,
          occurredAt: completedAt,
          correlationId: 'complete-test',
          payload: {
            visitId: eligible,
            propertyId,
            clientId,
            agentId,
            completedAt,
          },
        }),
      },
    ]);
    const schemaPath = new URL(
      '../../../contracts/events/visit/visit-completed.v1.schema.json',
      import.meta.url,
    );
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    expect(
      addFormats
        .default(new Ajv2020())
        .validate(schema, events[0].envelope.payload),
    ).toBe(true);
  });

  it('registra consultas y una sola oportunidad; solo los participantes pueden leer el contacto', async () => {
    const http = request(app.getHttpServer());
    const inquiryPath = '/api/v1/inquiries';
    const payload = {
      propertyId: inquiryPropertyId,
      contactName: 'María Pérez',
      contactEmail: 'maria@example.com',
      message: '¿Aceptan mascotas?',
    };
    const send = (
      input: object,
      key: string = randomUUID(),
      token: string | null = clientToken,
    ) => {
      const action = http.post(inquiryPath).set('Idempotency-Key', key);
      if (token) action.auth(token, { type: 'bearer' });
      return action.send(input);
    };
    await send(payload, randomUUID(), null).expect(401);
    await send(payload, randomUUID(), agentToken).expect(403);
    await send(payload, 'no-uuid').expect(400);
    await send({ ...payload, agentId }).expect(400);
    await send({ ...payload, contactName: '  ' }).expect(400);
    await send({ ...payload, contactEmail: 'no-es-correo' }).expect(400);
    await send({ ...payload, contactPhone: null }).expect(400);
    await send({ ...payload, message: 'Consulta\0' }).expect(400);
    await send({ ...payload, propertyId: pausedPropertyId })
      .expect(409)
      .expect(/PROPERTY_UNAVAILABLE/);
    await send({ ...payload, propertyId: randomUUID() })
      .expect(404)
      .expect(/PROPERTY_NOT_FOUND/);

    const key = randomUUID();
    const contactPhone = '+591 70000000';
    const [first, replay, second] = await Promise.all([
      send(payload, key).expect(201),
      send({ ...payload }, key).expect(201),
      send({ ...payload, contactPhone }).expect(201),
    ]);
    expect(replay.body).toEqual(first.body);
    expect(second.body).not.toEqual(first.body);
    await send({ ...payload, message: 'Otra consulta' }, key).expect(422);

    const { id } = first.body as { id: string };
    const location = inquiryPath + '/' + id;
    expect(first.headers.location).toBe(location);
    expect(replay.headers.location).toBe(location);
    for (const token of [clientToken, agentToken]) {
      const response = await http
        .get(location)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(response.body).toEqual({
        id,
        ...payload,
        createdAt: expect.any(String),
      });
    }
    const secondLocation =
      inquiryPath + '/' + (second.body as { id: string }).id;
    const secondDetail = await http
      .get(secondLocation)
      .auth(agentToken, { type: 'bearer' })
      .expect(200);
    expect(secondDetail.body).toMatchObject({ contactPhone });
    await http.get(location).auth(otherToken, { type: 'bearer' }).expect(404);
    await http
      .get(location)
      .auth(otherAgentToken, { type: 'bearer' })
      .expect(404);
    await http.get(location).expect(401);

    await http
      .post(path)
      .auth(clientToken, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ ...body, propertyId: inquiryPropertyId })
      .expect(201);
    const leads = await database.query<{ id: string }[]>(
      "SELECT id FROM leads WHERE client_id = $1 AND property_id = $2 AND status = 'OPEN'",
      [clientId, inquiryPropertyId],
    );
    expect(leads).toHaveLength(1);
    const events = await database.query<
      {
        topic: string;
        envelope: {
          eventType: string;
          eventId: string;
          aggregateId: string;
          causationId?: string;
          payload: unknown;
        };
      }[]
    >(
      "SELECT topic, envelope FROM outbox WHERE envelope->'payload'->>'propertyId' = $1",
      [inquiryPropertyId],
    );
    const inquiries = events.filter(
      ({ envelope }) => envelope.eventType === 'InquiryReceived',
    );
    expect(inquiries).toHaveLength(2);
    expect(events.map(({ envelope }) => envelope.eventType).sort()).toEqual([
      'InquiryReceived',
      'InquiryReceived',
      'LeadOpened',
      'VisitRequested',
    ]);
    const schemaPath = new URL(
      '../../../contracts/events/visit/inquiry-received.v1.schema.json',
      import.meta.url,
    );
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    const validate = addFormats.default(new Ajv2020()).compile(schema);
    for (const { topic, envelope } of inquiries) {
      expect(topic).toBe('visit.inquiry.events');
      expect(validate(envelope.payload)).toBe(true);
      expect(envelope.payload).toEqual({
        inquiryId: envelope.aggregateId,
        propertyId: inquiryPropertyId,
        clientId,
        agentId,
      });
    }
    expect(
      events.find(({ envelope }) => envelope.eventType === 'LeadOpened')
        ?.envelope,
    ).toMatchObject({
      aggregateId: leads[0].id,
      causationId: expect.stringMatching(
        new RegExp(inquiries.map(({ envelope }) => envelope.eventId).join('|')),
      ),
    });
  });

  it('pagina y ordena la bandeja de consultas sin exponer las de otro agente', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const tied = ids.slice(0, 2).sort();
    const date = new Date(Date.now() - 60_000);
    const later = new Date(date.getTime() + 1000);
    await database.query(
      `INSERT INTO inquiries
         (id, property_id, client_id, agent_id, contact_name, contact_email, contact_phone, message, created_at)
       VALUES ($1,$5,$6,$7,'Ana','ana@example.com','70000000','Mensaje privado',$9),
              ($2,$5,$6,$7,'Ana','ana@example.com',NULL,'Otro mensaje',$9),
              ($3,$5,$6,$7,'Ana','ana@example.com',NULL,'Otro mensaje',$10),
              ($4,$5,$6,$8,'Ana','ana@example.com',NULL,'Otro agente',$10)`,
      [...ids, inboxPropertyId, clientId, agentId, otherAgentId, date, later],
    );

    const http = request(app.getHttpServer());
    const endpoint = '/api/v1/inquiries';
    const list = (token: string, query: object) =>
      http.get(endpoint).auth(token, { type: 'bearer' }).query(query);
    await http.get(endpoint).expect(401);
    await list(clientToken, { propertyId: inboxPropertyId }).expect(403);
    const first = await list(agentToken, {
      propertyId: inboxPropertyId,
      size: 1,
    }).expect(200);
    expect(first.body).toEqual({
      data: [
        {
          id: ids[2],
          propertyId: inboxPropertyId,
          contactName: 'Ana',
          createdAt: later.toISOString(),
        },
      ],
      page: { number: 1, size: 1, totalElements: 3, totalPages: 3 },
    });
    const second = await list(agentToken, {
      propertyId: inboxPropertyId,
      size: 1,
      page: 2,
    }).expect(200);
    expect(second.body).toMatchObject({ data: [{ id: tied[1] }] });
    const ascending = await list(agentToken, {
      propertyId: inboxPropertyId,
      sort: 'createdAt,asc',
    }).expect(200);
    expect(ascending.body).toMatchObject({
      data: [{ id: tied[0] }, { id: tied[1] }, { id: ids[2] }],
      page: { number: 1, size: 20, totalElements: 3, totalPages: 1 },
    });
    const outside = await list(agentToken, {
      propertyId: inboxPropertyId,
      page: 9,
    }).expect(200);
    expect(outside.body).toEqual({
      data: [],
      page: { number: 9, size: 20, totalElements: 3, totalPages: 1 },
    });
    const other = await list(otherAgentToken, {
      propertyId: inboxPropertyId,
    }).expect(200);
    expect(other.body).toMatchObject({
      data: [{ id: ids[3] }],
      page: { totalElements: 1 },
    });
    await list(agentToken, { agentId: otherAgentId }).expect(400);
    await list(agentToken, { sort: 'createdAt,desc; DROP' }).expect(400);
  });

  it('lista visitas por rol y aplica los filtros al contenido y al total', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const requestedAt = new Date(Date.now() - 60_000);
    const scheduledStart = new Date(Date.now() + 10 * 86_400_000);
    const scheduledEnd = new Date(scheduledStart.getTime() + 3600_000);
    await database.query(
      `INSERT INTO visits
         (id, property_id, client_id, agent_id, status, proposed_at, requested_at, updated_at, scheduled_start, scheduled_end)
       VALUES ($1,$4,$5,$7,'REQUESTED',$9,$10,$10,NULL,NULL),
              ($2,$4,$6,$7,'SCHEDULED',$9,$11,$11,$12,$13),
              ($3,$4,$6,$8,'REQUESTED',$9,$11,$11,NULL,NULL)`,
      [
        ...ids,
        inboxPropertyId,
        clientId,
        otherClientId,
        agentId,
        otherAgentId,
        body.proposedAt,
        requestedAt,
        new Date(requestedAt.getTime() + 1000),
        scheduledStart,
        scheduledEnd,
      ],
    );
    const http = request(app.getHttpServer());
    const list = (token: string, query: object) =>
      http.get(path).auth(token, { type: 'bearer' }).query(query);
    const filter = { propertyId: inboxPropertyId };
    const all = await list(agentToken, filter).expect(200);
    expect(all.body).toMatchObject({
      data: [
        { id: ids[1], scheduledStart: scheduledStart.toISOString() },
        { id: ids[0] },
      ],
      page: { totalElements: 2, totalPages: 1 },
    });
    const pending = await list(agentToken, {
      ...filter,
      status: 'REQUESTED',
    }).expect(200);
    expect(pending.body).toMatchObject({
      data: [{ id: ids[0], status: 'REQUESTED' }],
      page: { totalElements: 1 },
    });
    const client = await list(clientToken, filter).expect(200);
    expect(client.body).toMatchObject({
      data: [{ id: ids[0] }],
      page: { totalElements: 1 },
    });
    const other = await list(otherAgentToken, filter).expect(200);
    expect(other.body).toMatchObject({
      data: [{ id: ids[2] }],
      page: { totalElements: 1 },
    });
    const empty = await list(agentToken, {
      ...filter,
      status: 'REJECTED',
    }).expect(200);
    expect(empty.body).toEqual({
      data: [],
      page: { number: 1, size: 20, totalElements: 0, totalPages: 0 },
    });
    for (const query of [
      { page: '0' },
      { page: ['1', '2'] },
      { size: '101' },
      { status: 'PENDING' },
      { propertyId: 'not-a-uuid' },
      { sort: 'createdAt,asc' },
    ]) {
      await list(agentToken, query)
        .expect(400)
        .expect(/VALIDATION_ERROR/);
    }
  });

  it('valida credenciales, rol, formato, fecha y estado de la propiedad', async () => {
    const http = request(app.getHttpServer());
    await http.get('/health/ready').expect(200, { status: 'UP' });
    await http
      .post(path)
      .send(body)
      .expect(401)
      .expect('WWW-Authenticate', 'Bearer')
      .expect('Content-Type', /application\/problem\+json/);
    await http
      .post(path)
      .auth(agentToken, { type: 'bearer' })
      .send(body)
      .expect(403);
    await http
      .post(path)
      .auth(clientToken, { type: 'bearer' })
      .send(body)
      .expect(400);
    const create = (payload: object) =>
      http
        .post(path)
        .auth(clientToken, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send(payload);
    await create([]).expect(400);
    await create({ ...body, agentId }).expect(400);
    await create({ ...body, proposedAt: '2020-01-01T00:00:00Z' })
      .expect(409)
      .expect(/VISIT_INVALID_PROPOSED_DATE/);
    await create({ ...body, propertyId: pausedPropertyId })
      .expect(409)
      .expect(/PROPERTY_UNAVAILABLE/);
    await create({ ...body, propertyId: randomUUID() })
      .expect(404)
      .expect(/PROPERTY_NOT_FOUND/);
  });
});
