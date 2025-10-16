import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from '../src/database/entities/coupon.entity';

describe('Coupons (e2e)', () => {
  let app: INestApplication;
  let repo: Repository<Coupon>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    repo = app.get<Repository<Coupon>>(getRepositoryToken(Coupon));
  });

  afterAll(async () => {
    await app.close();
  });

  it('preview returns discount for active percentage coupon', async () => {
    const c = repo.create({ code: 'NEW10', discountType: 'percentage', discountValue: 10, isActive: true });
    await repo.save(c);

    const res = await request(app.getHttpServer())
      .post('/coupons/preview')
      .send({ code: 'NEW10', amount: 200 })
      .expect(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.finalAmount).toBe(180);
  });
});


