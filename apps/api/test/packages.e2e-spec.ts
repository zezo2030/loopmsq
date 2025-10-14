import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventPackage } from '../src/database/entities/event-package.entity';

describe('Packages (e2e)', () => {
  let app: INestApplication;
  let repo: Repository<EventPackage>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    repo = app.get<Repository<EventPackage>>(getRepositoryToken(EventPackage));
  });

  afterAll(async () => {
    await app.close();
  });

  it('preview computes total using base + perPerson + perHour', async () => {
    const p = repo.create({
      branchId: '00000000-0000-0000-0000-000000000001',
      eventType: 'birthday',
      name: 'Birthday Basic',
      basePrice: 100,
      pricePerPerson: 2,
      pricePerHour: 10,
      isActive: true,
    });
    await repo.save(p);

    const res = await request(app.getHttpServer())
      .post('/admin/packages/preview')
      .send({ packageId: p.id, persons: 10, durationHours: 3 })
      .expect(201);
    expect(res.body.valid).toBe(true);
    expect(res.body.total).toBe(100 + (2 * 10) + (10 * 3));
  });
});


