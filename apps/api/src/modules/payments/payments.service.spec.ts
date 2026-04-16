import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { OfferBooking } from '../../database/entities/offer-booking.entity';
import {
  OfferCategory,
  OfferProduct,
} from '../../database/entities/offer-product.entity';
import { OfferTicket } from '../../database/entities/offer-ticket.entity';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../database/entities/payment.entity';
import { MoyasarService } from '../../integrations/moyasar/moyasar.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';
import { BookingsService } from '../bookings/bookings.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OfferBookingsService } from '../offer-bookings/offer-bookings.service';
import { ReferralsService } from '../referrals/referrals.service';
import { SubscriptionPurchasesService } from '../subscription-purchases/subscription-purchases.service';
import { WalletService } from '../wallet/wallet.service';
import { TripsService } from '../trips/trips.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepo: jest.Mocked<Repository<Payment>>;
  let bookingRepo: jest.Mocked<Repository<Booking>>;
  let moyasarService: { retrievePayment: jest.Mock };
  let qrCodeServiceMock: {
    generateOfferTicketToken: jest.Mock;
    hashToken: jest.Mock;
  };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      create: jest.Mock;
      save: jest.Mock;
    };
  };

  const paymentQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const paymentRepoMock = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => paymentQueryBuilder),
  } as unknown as jest.Mocked<Repository<Payment>>;

  const bookingRepoMock = {
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<Booking>>;

  const configServiceMock = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'MOYASAR_SECRET_KEY':
          return 'sk_test_server';
        case 'PAYMENTS_BYPASS':
          return 'false';
        default:
          return undefined;
      }
    }),
  };

  const redisMock: Partial<RedisService> = {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
  };

  const notificationsMock = {
    enqueue: jest.fn(async () => undefined),
  };

  const loyaltyMock = {
    awardPoints: jest.fn(async () => undefined),
  };

  const referralsMock = {
    createEarningForFirstPayment: jest.fn(async () => undefined),
  };

  const bookingsMock = {
    issueTicketsForBooking: jest.fn(async () => undefined),
  };

  const tripsServiceMock = {
    quotePayFirstSchoolTripIntent: jest.fn(),
    insertSchoolTripFromPayFirstConfirmation: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    queryRunner = {
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      manager: {
        create: jest.fn((_: unknown, data: Partial<Payment>) => ({
          id: 'internal-payment-1',
          ...data,
        })),
        save: jest.fn(async <T>(entity: T) => entity),
      },
    };

    const dataSourceMock = {
      createQueryRunner: jest.fn(() => queryRunner),
      getRepository: jest.fn(),
    } as unknown as DataSource;

    moyasarService = {
      retrievePayment: jest.fn(),
    };

    qrCodeServiceMock = {
      generateOfferTicketToken: jest
        .fn()
        .mockImplementation((value: string) => `token:${value}`),
      hashToken: jest
        .fn()
        .mockImplementation((value: string) => `hash:${value}`),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepoMock },
        { provide: getRepositoryToken(Booking), useValue: bookingRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: RedisService, useValue: redisMock },
        { provide: NotificationsService, useValue: notificationsMock },
        { provide: LoyaltyService, useValue: loyaltyMock },
        { provide: ReferralsService, useValue: referralsMock },
        { provide: RealtimeGateway, useValue: {} },
        { provide: BookingsService, useValue: bookingsMock },
        { provide: MoyasarService, useValue: moyasarService },
        { provide: WalletService, useValue: {} },
        { provide: QRCodeService, useValue: qrCodeServiceMock },
        { provide: OfferBookingsService, useValue: {} },
        { provide: SubscriptionPurchasesService, useValue: {} },
        { provide: TripsService, useValue: tripsServiceMock },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
    paymentRepo = moduleRef.get(getRepositoryToken(Payment));
    bookingRepo = moduleRef.get(getRepositoryToken(Booking));
  });

  it('creates intent and returns an internal processing payment for card payments', async () => {
    bookingRepo.findOne.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PENDING,
      totalPrice: 100,
      payments: [],
      user: { id: 'user-1' },
    } as Booking);

    const res = await service.createIntent('user-1', {
      bookingId: 'booking-1',
      method: PaymentMethod.CREDIT_CARD,
    });

    expect(res.paymentId).toBe('internal-payment-1');
    expect(res.chargeId).toBe('');
    expect(res.status).toBe(PaymentStatus.PROCESSING);
  });

  it('creates offer-product intent using base price plus selected add-ons', async () => {
    const offerRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'offer-1',
        isActive: true,
        price: 100,
        includedAddOns: [
          { addonId: 'meal', name: 'Meal', price: 25 },
          { addonId: 'drink', name: 'Drink', price: 10 },
        ],
      } as OfferProduct),
    };

    ((service as any).dataSource.getRepository as jest.Mock).mockImplementation(
      (entity: unknown) => {
        if (entity === OfferProduct) return offerRepo;
        return {};
      },
    );

    const res = await service.createIntent('user-1', {
      offerProductId: 'offer-1',
      acceptedTerms: true,
      addOns: [
        { id: 'meal', quantity: 2 },
        { id: 'drink', quantity: 1 },
      ],
      method: PaymentMethod.CREDIT_CARD,
    });

    expect(res.amount).toBe(160);
    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      Payment,
      expect.objectContaining({
        amount: 160,
      }),
    );
  });

  it('seeds qrTokenHash before inserting offer tickets in post-payment booking creation', async () => {
    const offerRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'offer-1',
        branchId: 'branch-1',
        title: 'Lunch Offer',
        description: 'desc',
        imageUrl: null,
        termsAndConditions: 'terms',
        offerCategory: OfferCategory.TICKET_BASED,
        ticketConfig: null,
        hoursConfig: null,
        includedAddOns: [],
        price: 100,
        currency: 'SAR',
        isActive: true,
        canRepeatInSameOrder: true,
      } as OfferProduct),
    };
    const bookingRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => data),
      save: jest.fn().mockImplementation(async (booking) => ({
        id: 'booking-1',
        ...booking,
      })),
    };
    const ticketRepo = {
      create: jest.fn((data) => data),
      save: jest
        .fn()
        .mockImplementationOnce(async (ticket) => ({
          id: 'ticket-1',
          ...ticket,
        }))
        .mockImplementationOnce(async (ticket) => ticket),
    };
    const paymentQueryRunner = {
      manager: {
        getRepository: jest.fn((entity) => {
          if (entity === OfferProduct) return offerRepo;
          if (entity === OfferBooking) return bookingRepo;
          if (entity === OfferTicket) return ticketRepo;
          return null;
        }),
      },
    };

    await (service as any).createOfferBookingAfterPayment(
      paymentQueryRunner,
      'user-1',
      {
        offerProductId: 'offer-1',
        acceptedTerms: true,
        addOns: [],
      },
    );

    expect(ticketRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        qrTokenHash: expect.stringMatching(/^hash:token:pending-/),
      }),
    );
    expect(ticketRepo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        qrTokenHash: 'hash:token:ticket-1',
      }),
    );
  });

  it('confirms a booking payment after verifying the external Moyasar payment', async () => {
    bookingRepo.findOne.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PENDING,
      payments: [],
    } as Booking);

    paymentRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'internal-payment-1',
      bookingId: 'booking-1',
      amount: 100,
      currency: 'SAR',
      method: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.PROCESSING,
    } as Payment);
    paymentQueryBuilder.getOne.mockResolvedValue(undefined);

    moyasarService.retrievePayment.mockResolvedValue({
      id: 'mysr-payment-1',
      status: 'paid',
      amount: 10000,
      currency: 'SAR',
    });

    const result = await service.confirmPayment('user-1', {
      bookingId: 'booking-1',
      paymentId: 'mysr-payment-1',
    });

    expect(result.success).toBe(true);
    expect(moyasarService.retrievePayment).toHaveBeenCalledWith(
      'mysr-payment-1',
    );
    expect(queryRunner.manager.save).toHaveBeenCalled();
    expect(bookingsMock.issueTicketsForBooking).toHaveBeenCalledWith(
      'booking-1',
    );
  });

  it('rejects Moyasar payments when the verified amount does not match', async () => {
    bookingRepo.findOne.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PENDING,
      payments: [],
    } as Booking);

    paymentRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'internal-payment-1',
      bookingId: 'booking-1',
      amount: 100,
      currency: 'SAR',
      method: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.PROCESSING,
    } as Payment);
    paymentQueryBuilder.getOne.mockResolvedValue(undefined);

    moyasarService.retrievePayment.mockResolvedValue({
      id: 'mysr-payment-1',
      status: 'paid',
      amount: 9900,
      currency: 'SAR',
    });

    await expect(
      service.confirmPayment('user-1', {
        bookingId: 'booking-1',
        paymentId: 'mysr-payment-1',
      }),
    ).rejects.toThrow('Payment amount mismatch');
  });

  it('rejects Moyasar payments when the verified currency does not match', async () => {
    bookingRepo.findOne.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PENDING,
      payments: [],
    } as Booking);

    paymentRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'internal-payment-1',
      bookingId: 'booking-1',
      amount: 100,
      currency: 'SAR',
      method: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.PROCESSING,
    } as Payment);
    paymentQueryBuilder.getOne.mockResolvedValue(undefined);

    moyasarService.retrievePayment.mockResolvedValue({
      id: 'mysr-payment-1',
      status: 'paid',
      amount: 10000,
      currency: 'USD',
    });

    await expect(
      service.confirmPayment('user-1', {
        bookingId: 'booking-1',
        paymentId: 'mysr-payment-1',
      }),
    ).rejects.toThrow('Payment currency mismatch');
  });
});
