import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
  const clientId = randomUUID();
  const agentId = randomUUID();
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

  beforeAll(async () => {
    database = await createDataSource(databaseUrl!).initialize();
    await database.runMigrations();
    await database.query(
      `INSERT INTO property_snapshots
        (property_id, agent_id, title, zone, operation_type, status, last_event_at, updated_at)
       VALUES ($1,$2,'Casa','Centro','SALE','PUBLISHED',now(),now()),
              ($3,$2,'Casa','Centro','SALE','PAUSED',now(),now())`,
      [propertyId, agentId, pausedPropertyId],
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
    [clientToken, agentToken, otherToken] = await Promise.all([
      token(clientId, 'CLIENT'),
      token(agentId, 'AGENT'),
      token(randomUUID(), 'CLIENT'),
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
          "DELETE FROM outbox WHERE envelope->'payload'->>'propertyId' = $1",
          [propertyId],
        );
        await manager.query(
          'DELETE FROM idempotency_records WHERE client_id = $1',
          [clientId],
        );
        await manager.query('DELETE FROM visits WHERE property_id = $1', [
          propertyId,
        ]);
        await manager.query('DELETE FROM leads WHERE property_id = $1', [
          propertyId,
        ]);
        await manager.query(
          'DELETE FROM property_snapshots WHERE property_id IN ($1,$2)',
          [propertyId, pausedPropertyId],
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
