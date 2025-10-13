import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus, PaymentMethod } from '../../database/entities/payment.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from '../../utils/redis.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepo: Repository<Payment>;
  let bookingRepo: Repository<Booking>;

  const paymentRepoMock = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  } as any;

  const bookingRepoMock = {
    findOne: jest.fn(),
    save: jest.fn(),
  } as any;

  const dataSourceMock = {
    createQueryRunner: () => ({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: (entity: any, data: any) => ({ ...data, id: 'pay_1' }),
        save: jest.fn((e: any) => e),
      },
    }),
  } as any as DataSource;

  const redisMock: Partial<RedisService> = {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: false })],
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepoMock },
        { provide: getRepositoryToken(Booking), useValue: bookingRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
    paymentRepo = moduleRef.get(getRepositoryToken(Payment));
    bookingRepo = moduleRef.get(getRepositoryToken(Booking));
  });

  it('creates intent and returns clientSecret', async () => {
    bookingRepo.findOne.mockResolvedValue({
      id: 'b1',
      userId: 'u1',
      status: BookingStatus.PENDING,
      totalPrice: 100,
      payments: [],
    });

    const res = await service.createIntent('u1', {
      bookingId: 'b1',
      method: PaymentMethod.CREDIT_CARD,
    });

    expect(res.paymentId).toBeDefined();
    expect(res.clientSecret).toContain('mock_secret_');
  });

  it('confirms a payment and sets booking confirmed', async () => {
    bookingRepo.findOne.mockResolvedValue({
      id: 'b1',
      userId: 'u1',
      status: BookingStatus.PENDING,
      payments: [
        {
          id: 'pay1',
          status: PaymentStatus.PROCESSING,
          gatewayRef: 'mock_secret_pay1',
        },
      ],
    });

    const result = await service.confirmPayment('u1', {
      bookingId: 'b1',
      paymentId: 'pay1',
      gatewayPayload: { clientSecret: 'mock_secret_pay1' },
    });

    expect(result.success).toBe(true);
  });
});


