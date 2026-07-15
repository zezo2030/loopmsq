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
import { SubscriptionPlan } from '../../database/entities/subscription-plan.entity';
import {
  SubscriptionPurchase,
  SubscriptionPurchasePaymentStatus,
} from '../../database/entities/subscription-purchase.entity';
import { MoyasarService } from '../../integrations/moyasar/moyasar.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';
import { BookingsService } from '../bookings/bookings.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';
import { GiftOrdersService } from '../gift-orders/gift-orders.service';
import { CouponsService } from '../coupons/coupons.service';
import { InvoiceQueueService } from '../invoicing/invoice-queue.service';
import { ReferralsService } from '../referrals/referrals.service';
import { OfferBookingsService } from '../offer-bookings/offer-bookings.service';
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
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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
    acquireLock: jest.fn(async () => true),
    releaseLock: jest.fn(async () => undefined),
  };

  const notificationsMock = {
    enqueue: jest.fn(async () => undefined),
  };

  const loyaltyMock = {
    awardPoints: jest.fn(async () => undefined),
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
        { provide: AdminNotificationsService, useValue: { notify: jest.fn() } },
        { provide: LoyaltyService, useValue: loyaltyMock },
        { provide: RealtimeGateway, useValue: {} },
        { provide: BookingsService, useValue: bookingsMock },
        { provide: MoyasarService, useValue: moyasarService },
        { provide: WalletService, useValue: {} },
        { provide: QRCodeService, useValue: qrCodeServiceMock },
        { provide: OfferBookingsService, useValue: {} },
        { provide: SubscriptionPurchasesService, useValue: {} },
        { provide: TripsService, useValue: tripsServiceMock },
        { provide: GiftOrdersService, useValue: {} },
        { provide: CouponsService, useValue: {} },
        { provide: InvoiceQueueService, useValue: { enqueue: jest.fn(async () => undefined) } },
        {
          provide: ReferralsService,
          useValue: { processRefereePayment: jest.fn(async () => undefined) },
        },
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

  it('reuses the createPurchase payment for subscription intents (coupon amount, no duplicate)', async () => {
    const existingPayment = {
      id: 'sub-pay-canonical',
      subscriptionPurchaseId: 'sub-purchase-1',
      amount: 254.15,
      currency: 'SAR',
      method: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.PENDING,
      gatewayRef: null,
    } as Payment;

    const subPurchaseRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'sub-purchase-1',
        userId: 'user-1',
        subscriptionPlanId: 'plan-1',
        paymentStatus: SubscriptionPurchasePaymentStatus.PENDING,
      } as SubscriptionPurchase),
    };
    const planRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'plan-1',
        price: 299,
        currency: 'SAR',
      } as SubscriptionPlan),
    };

    ((service as any).dataSource.getRepository as jest.Mock).mockImplementation(
      (entity: unknown) => {
        if (entity === SubscriptionPurchase) return subPurchaseRepo;
        if (entity === SubscriptionPlan) return planRepo;
        return {};
      },
    );

    paymentRepo.findOne
      .mockResolvedValueOnce(existingPayment)
      .mockResolvedValue(null);
    paymentRepo.save.mockImplementation(async (p: Payment) => p);
    paymentRepo.find.mockResolvedValue([
      existingPayment,
      {
        id: 'sub-pay-wrong-full-price',
        subscriptionPurchaseId: 'sub-purchase-1',
        amount: 299,
        currency: 'SAR',
        method: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.PROCESSING,
      } as Payment,
    ]);
    paymentRepo.update.mockResolvedValue({ affected: 1 } as any);

    const res = await service.createIntent('user-1', {
      subscriptionPurchaseId: 'sub-purchase-1',
      method: PaymentMethod.CREDIT_CARD,
    });

    expect(res.paymentId).toBe('sub-pay-canonical');
    expect(Number(res.amount)).toBe(254.15);
    expect(res.status).toBe(PaymentStatus.PROCESSING);
    expect(queryRunner.manager.create).not.toHaveBeenCalled();
    expect(paymentRepo.update).toHaveBeenCalled();
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

  it('aligns subscription payment amount to Moyasar when a sibling quote payment matches', async () => {
    const processingPayment = {
      id: 'sub-pay-wrong',
      subscriptionPurchaseId: 'sub-purchase-1',
      amount: 299,
      currency: 'SAR',
      method: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.PROCESSING,
      gatewayRef: null,
    } as Payment;

    paymentQueryBuilder.getOne.mockResolvedValue(processingPayment);
    paymentRepo.findOne.mockResolvedValue(processingPayment);
    paymentRepo.find.mockResolvedValue([
      {
        id: 'sub-pay-quote',
        subscriptionPurchaseId: 'sub-purchase-1',
        amount: 254.15,
        status: PaymentStatus.PENDING,
      } as Payment,
      processingPayment,
    ]);

    ((service as any).dataSource.getRepository as jest.Mock).mockImplementation(
      (entity: unknown) => {
        if (entity === SubscriptionPurchase) {
          return {
            findOne: jest.fn().mockResolvedValue({
              id: 'sub-purchase-1',
              userId: 'user-1',
            }),
          };
        }
        return { findOne: jest.fn() };
      },
    );

    const confirmSubscription = jest.fn(async () => undefined);
    (service as any).subscriptionPurchasesService = {
      confirmPayment: confirmSubscription,
    };

    moyasarService.retrievePayment.mockResolvedValue({
      id: 'mysr-sub-1',
      status: 'paid',
      amount: 25415,
      currency: 'SAR',
    });

    const result = await service.confirmPayment('user-1', {
      paymentId: 'sub-pay-wrong',
      gatewayPayload: { moyasarPaymentId: 'mysr-sub-1' },
    });

    expect(result.success).toBe(true);
    expect(Number(processingPayment.amount)).toBe(254.15);
    expect(confirmSubscription).toHaveBeenCalledWith('sub-purchase-1');
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
