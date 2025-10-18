import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('AdminConfig (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Note: endpoints require auth + admin role in production.
  // Here we only assert that unauthorized returns 401 to ensure guards are applied.
  it('GET /admin/config/otp should be unauthorized without token', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/config/otp').expect(401);
  });

  it('GET /admin/config/sms should be unauthorized without token', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/config/sms').expect(401);
  });
});


