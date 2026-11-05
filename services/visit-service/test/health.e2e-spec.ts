import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { VisitDatabase } from '../src/database/visit-database.js';

describe('Salud de Visit', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VisitDatabase)
      .useValue({
        connect: () => Promise.reject(new Error('PostgreSQL no disponible')),
      })
      .compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('mantiene liveness mientras PostgreSQL no responde', () =>
    request(app.getHttpServer()).get('/health').expect(200, { status: 'UP' }));

  it('marca readiness como DOWN mientras PostgreSQL no responde', () =>
    request(app.getHttpServer())
      .get('/health/ready')
      .expect(503, { status: 'DOWN' }));
});
