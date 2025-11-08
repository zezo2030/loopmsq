import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('ContentController - Slots Endpoint (e2e)', () => {
  let app: INestApplication;

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

  const hallId = '11111111-1111-1111-1111-111111111111';

  it('should return 400 when date query parameter is missing', () => {
    return request(app.getHttpServer())
      .get(`/content/halls/${hallId}/slots`)
      .expect(400);
  });

  it('should return 400 when date query parameter is invalid', () => {
    return request(app.getHttpServer())
      .get(`/content/halls/${hallId}/slots`)
      .query({ date: 'invalid-date' })
      .expect(400);
  });
});

