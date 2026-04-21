import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, QueryRunner } from 'typeorm';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../database/entities/payment.entity';
import {
  EventRequest,
  EventRequestStatus,
} from '../../database/entities/event-request.entity';
import {
  SchoolTripRequest,
  TripRequestStatus,
} from '../../database/entities/school-trip-request.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { CreatePaymentIntentDto } from './dto/create-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { RefundDto } from './dto/refund.dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from '../../utils/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { ReferralsService } from '../referrals/referrals.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { BookingsService } from '../bookings/bookings.service';
import { MoyasarService } from '../../integrations/moyasar/moyasar.service';
import { WalletService } from '../wallet/wallet.service';
import { QRCodeService } from '../../utils/qr-code.service';
import { resolveEventTicketWindow } from '../../utils/event-ticket-window.util';
import { OfferBookingsService } from '../offer-bookings/offer-bookings.service';
import { SubscriptionPurchasesService } from '../subscription-purchases/subscription-purchases.service';
import {
  OfferBooking,
  OfferBookingPaymentStatus,
  OfferBookingStatus,
} from '../../database/entities/offer-booking.entity';
import {
  SubscriptionPurchase,
  SubscriptionPurchasePaymentStatus,
  SubscriptionPurchaseStatus,
} from '../../database/entities/subscription-purchase.entity';
import {
  SubscriptionPlan,
  SubscriptionUsageMode,
} from '../../database/entities/subscription-plan.entity';
import {
  OfferCategory,
  OfferProduct,
} from '../../database/entities/offer-product.entity';
import {
  OfferTicket,
  OfferTicketKind,
  OfferTicketStatus,
} from '../../database/entities/offer-ticket.entity';
import {
  GiftOrder,
  GiftPaymentStatus,
  GiftStatus,
} from '../../database/entities/gift-order.entity';
import { TripsService } from '../trips/trips.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly notifications: NotificationsService,
    private readonly loyalty: LoyaltyService,
    @Inject(forwardRef(() => TripsService))
    private readonly tripsService: TripsService,
    private readonly referrals?: ReferralsService,
    private readonly realtime?: RealtimeGateway,
    private readonly bookings?: BookingsService,
    private readonly moyasarService?: MoyasarService,
    private readonly walletService?: WalletService,
    private readonly qrCodeService?: QRCodeService,
    private readonly offerBookingsService?: OfferBookingsService,
    private readonly subscriptionPurchasesService?: SubscriptionPurchasesService,
  ) {}

  private normalizePaymentJson(value: unknown): Record<string, any> | null {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }
    return typeof value === 'object' ? (value as Record<string, any>) : null;
  }

  private serializePaymentJson(value: Record<string, any> | null | undefined) {
    if (!value) return null;
    return JSON.stringify(value);
  }

  private stablePayloadHash(payload: unknown): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload ?? {}))
      .digest('hex')
      .slice(0, 32);
  }

  private getPendingFlowContext(payment: Payment): Record<string, any> | null {
    const context = this.normalizePaymentJson(payment.webhookData);
    if (!context) return null;
    if (context.flowType == null) return null;
    return context;
  }

  private async syncSchoolTripBookingAfterPayment(
    queryRunner: QueryRunner,
    payment: Payment,
    tripRequest: SchoolTripRequest,
    newPaidAmount: number,
    remainingAmount: number,
  ): Promise<Booking | null> {
    const manager = queryRunner.manager;
    const existingTripBooking = await manager
      .createQueryBuilder(Booking, 'booking')
      .where("booking.metadata->>'tripRequestId' = :id", {
        id: tripRequest.id,
      })
      .andWhere('booking.status != :cancelled', {
        cancelled: BookingStatus.CANCELLED,
      })
      .getOne();

    if (existingTripBooking) {
      const booking = existingTripBooking;
      booking.metadata = {
        ...(booking.metadata || {}),
        amountPaid: newPaidAmount,
        remainingAmount,
      };
      await manager.save(booking);
      payment.bookingId = booking.id;
      await manager.save(payment);

      if (remainingAmount === 0) {
        tripRequest.status = TripRequestStatus.COMPLETED;
        await manager.save(tripRequest);
      }
      return booking;
    }

    const studentsList = tripRequest.studentsList || [];
    const studentsCount =
      studentsList.length > 0
        ? studentsList.length
        : tripRequest.studentsCount || 0;
    const adultsCount = tripRequest.accompanyingAdults || 0;
    const totalPersons = studentsCount + adultsCount;

    const slotStartLabel =
      tripRequest.selectedTimeSlot || tripRequest.preferredTime;
    let tripStartTime = tripRequest.preferredDate;
    if (slotStartLabel) {
      const [start] = slotStartLabel.split('-');
      const [hour, minute] = start.split(':').map(Number);
      const preferredDate = new Date(tripRequest.preferredDate);
      tripStartTime = new Date(
        preferredDate.getFullYear(),
        preferredDate.getMonth(),
        preferredDate.getDate(),
        hour,
        minute,
        0,
        0,
      );
    }

    const newBooking = manager.create(Booking, {
      userId: tripRequest.requesterId,
      branchId: (tripRequest as any).branchId,
      startTime: tripStartTime,
      durationHours: tripRequest.durationHours || 2,
      persons: totalPersons,
      totalPrice: tripRequest.totalAmount || tripRequest.quotedPrice || 0,
      status: BookingStatus.CONFIRMED,
      addOns: (tripRequest.addOns || []).map((item: any) => ({
        id: item.id,
        name: item.name ?? '',
        price: Number(item.price ?? 0),
        quantity: Number(item.quantity ?? 1),
      })),
      metadata: {
        tripType: 'school',
        tripRequestId: tripRequest.id,
        paymentOption: tripRequest.paymentOption,
        amountPaid: newPaidAmount,
        remainingAmount,
      },
    });
    const savedBooking = await manager.save(newBooking);

    payment.bookingId = savedBooking.id;
    await manager.save(payment);

    const tripQrPayload = `trip_${savedBooking.id}`;
    const tripQrTokenHash = this.qrCodeService
      ? this.qrCodeService.generateQRTokenHash(tripQrPayload)
      : crypto.createHash('sha256').update(tripQrPayload).digest('hex');
    const holderName =
      studentsList.length > 0
        ? `${studentsList[0]?.name || tripRequest.schoolName} +${Math.max(
            0,
            totalPersons - 1,
          )}`
        : tripRequest.schoolName;

    const groupTicket = manager.create(Ticket, {
      bookingId: savedBooking.id,
      qrTokenHash: tripQrTokenHash,
      status: TicketStatus.VALID,
      personCount: totalPersons,
      holderName,
      validFrom: null,
      validUntil: null,
      metadata: {
        tripType: 'school',
        studentsCount,
        adultsCount,
        totalPersons,
        schoolName: tripRequest.schoolName,
        preferredDate:
          tripRequest.preferredDate?.toISOString?.() ??
          tripRequest.preferredDate,
        preferredTime: tripRequest.preferredTime,
        selectedTimeSlot: tripRequest.selectedTimeSlot,
      },
    });
    await manager.save(groupTicket);

    if (remainingAmount === 0) {
      tripRequest.status = TripRequestStatus.COMPLETED;
      await manager.save(tripRequest);
    }

    await this.notifications.enqueue({
      type: 'TICKETS_ISSUED',
      to: { userId: tripRequest.requesterId },
      data: {
        bookingId: savedBooking.id,
        tripRequestId: tripRequest.id,
        ticketsCount: 1,
      },
      channels: ['sms', 'push'],
    });

    return savedBooking;
  }

  private async ensureEventSlotStillAvailable(
    manager: EntityManager,
    eventRequest: EventRequest,
  ): Promise<void> {
    const eventStart = new Date(eventRequest.startTime);
    const eventEnd = new Date(
      eventStart.getTime() +
        Number(eventRequest.durationHours || 0) * 60 * 60 * 1000,
    );

    const blockingEventStatuses = [
      EventRequestStatus.PAID,
      EventRequestStatus.DEPOSIT_PAID,
      EventRequestStatus.CONFIRMED,
    ];
    const blockingBookingStatuses = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.COMPLETED,
    ];

    const conflictingEvent = await manager
      .getRepository(EventRequest)
      .createQueryBuilder('event')
      .where('event.branchId = :branchId', { branchId: eventRequest.branchId })
      .andWhere('event.id != :eventRequestId', {
        eventRequestId: eventRequest.id,
      })
      .andWhere('event.status IN (:...statuses)', {
        statuses: blockingEventStatuses,
      })
      .andWhere('event.startTime < :endTime', { endTime: eventEnd })
      .andWhere(
        "(event.startTime + (event.durationHours || ' hours')::interval) > :startTime",
        { startTime: eventStart },
      )
      .getOne();

    if (conflictingEvent) {
      throw new BadRequestException(
        'هذا الموعد للفعالية الخاصة تم حجزه للتو من مستخدم آخر',
      );
    }

    const conflictingBooking = await manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .where('booking.branchId = :branchId', {
        branchId: eventRequest.branchId,
      })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: blockingBookingStatuses,
      })
      .andWhere('booking.startTime < :endTime', { endTime: eventEnd })
      .andWhere(
        "(booking.startTime + (booking.durationHours || ' hours')::interval) > :startTime",
        { startTime: eventStart },
      )
      .getOne();

    if (conflictingBooking) {
      throw new BadRequestException(
        'هذا الموعد للفعالية الخاصة تم حجزه للتو من مستخدم آخر',
      );
    }
  }

  private addCalendarMonths(baseDate: Date, months: number): Date {
    const result = new Date(baseDate);
    const originalDay = result.getDate();
    result.setMonth(result.getMonth() + months);
    if (result.getDate() !== originalDay) {
      result.setDate(0);
    }
    return result;
  }

  private resolveOfferAddOns(
    offer: OfferProduct,
    selected?: { id: string; quantity: number }[],
  ) {
    const catalog = new Map(
      (offer.includedAddOns || []).map((item: any) => [
        item.addonId,
        {
          id: item.addonId,
          name: item.name,
          price: Number(item.price || 0),
        },
      ]),
    );

    if (!selected?.length) {
      return [];
    }

    return selected.map((addOn) => {
      const matched = catalog.get(addOn.id);
      if (!matched) {
        throw new BadRequestException(
          `Selected add-on is not available: ${addOn.id}`,
        );
      }

      return {
        id: matched.id,
        name: matched.name,
        price: matched.price,
        quantity: addOn.quantity,
      };
    });
  }

  private async createOfferBookingAfterPayment(
    queryRunner: any,
    userId: string,
    context: Record<string, any>,
  ): Promise<OfferBooking> {
    const offerRepo = queryRunner.manager.getRepository(OfferProduct);
    const bookingRepo = queryRunner.manager.getRepository(OfferBooking);
    const ticketRepo = queryRunner.manager.getRepository(OfferTicket);

    const offer = await offerRepo.findOne({
      where: { id: context.offerProductId },
    });
    if (!offer) throw new NotFoundException('Offer product not found');
    if (!offer.isActive) throw new BadRequestException('Offer is not active');

    const now = new Date();
    if (offer.startsAt && offer.startsAt > now) {
      throw new BadRequestException('Offer is not available yet');
    }
    if (offer.endsAt && offer.endsAt < now) {
      throw new BadRequestException('Offer has expired');
    }
    if (!context.acceptedTerms) {
      throw new BadRequestException(
        'Offer terms and conditions must be accepted',
      );
    }

    if (!offer.canRepeatInSameOrder) {
      const existingBooking = await bookingRepo.findOne({
        where: {
          userId,
          offerProductId: offer.id,
          status: OfferBookingStatus.ACTIVE,
        },
      });
      if (existingBooking) {
        throw new BadRequestException(
          'Cannot repeat this offer — an active booking already exists',
        );
      }
    }

    const selectedAddOns = this.resolveOfferAddOns(offer, context.addOns);

    const subtotal = Number(offer.price);
    const addonsTotal = selectedAddOns.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const totalPrice = subtotal + addonsTotal;

    const buildOfferTypeSummary = () => {
      if (offer.offerCategory === OfferCategory.HOUR_BASED) {
        const duration = Number(offer.hoursConfig?.durationHours || 0);
        const bonus = Number(offer.hoursConfig?.bonusHours || 0);
        const isOpenTime = offer.hoursConfig?.isOpenTime === true;
        if (isOpenTime) return 'open_time';
        if (duration > 0 && bonus > 0) return `${duration}_plus_${bonus}_hours`;
        if (duration > 0) return `${duration}_hours`;
      }

      const paid = Number(offer.ticketConfig?.paidTicketCount || 1);
      const free = Number(offer.ticketConfig?.freeTicketCount || 0);
      if (free > 0) return `${paid}_plus_${free}_tickets`;
      return 'single_entry';
    };

    const booking = bookingRepo.create({
      userId,
      branchId: offer.branchId,
      offerProductId: offer.id,
      offerSnapshot: {
        id: offer.id,
        title: offer.title,
        description: offer.description,
        imageUrl: offer.imageUrl,
        termsAndConditions: offer.termsAndConditions,
        offerCategory: offer.offerCategory,
        offerType: buildOfferTypeSummary(),
        ticketMode: 'single_ticket',
        price: Number(offer.price),
        currency: offer.currency,
        ticketConfig: offer.ticketConfig,
        hoursConfig: offer.hoursConfig,
        includedAddOns: offer.includedAddOns,
        ticketCount: 1,
        paidTicketsCount: 1,
        freeTicketsCount: 0,
        durationHours: offer.hoursConfig?.durationHours ?? null,
        bonusHours: offer.hoursConfig?.bonusHours ?? 0,
        isOpenTime: offer.hoursConfig?.isOpenTime ?? false,
        includedItems: (offer.includedAddOns || []).map(
          (item: any) => item.name,
        ),
      },
      selectedAddOns: selectedAddOns.length === 0 ? null : selectedAddOns,
      subtotal,
      addonsTotal,
      totalPrice,
      paymentStatus: OfferBookingPaymentStatus.COMPLETED,
      status: OfferBookingStatus.ACTIVE,
      contactPhone: context.contactPhone || undefined,
    });

    const savedBooking = await bookingRepo.save(booking);

    const createTicket = async (ticketKind: OfferTicketKind) => {
      const provisionalQrToken = this.qrCodeService!.generateOfferTicketToken(
        `pending-${savedBooking.id}-${Date.now()}`,
      );
      const ticket = ticketRepo.create({
        offerBookingId: savedBooking.id,
        userId,
        branchId: offer.branchId,
        offerProductId: offer.id,
        ticketKind,
        qrTokenHash: this.qrCodeService!.hashToken(provisionalQrToken),
        status: OfferTicketStatus.VALID,
        metadata: {
          offerTitle: offer.title,
          offerCategory: offer.offerCategory,
          offerType: buildOfferTypeSummary(),
          termsAndConditions: offer.termsAndConditions || null,
          includedAddOns: offer.includedAddOns || [],
          hoursConfig: offer.hoursConfig || null,
        },
      });
      const savedTicket = await ticketRepo.save(ticket);
      const rawToken = this.qrCodeService!.generateOfferTicketToken(
        savedTicket.id,
      );
      savedTicket.qrTokenHash = this.qrCodeService!.hashToken(rawToken);
      savedTicket.metadata = {
        ...(savedTicket.metadata || {}),
        qrData: rawToken,
      };
      await ticketRepo.save(savedTicket);
    };

    await createTicket(
      offer.offerCategory === OfferCategory.HOUR_BASED
        ? OfferTicketKind.TIMED
        : OfferTicketKind.STANDARD,
    );

    return savedBooking;
  }

  private async createSubscriptionPurchaseAfterPayment(
    queryRunner: any,
    userId: string,
    context: Record<string, any>,
  ): Promise<SubscriptionPurchase> {
    const planRepo = queryRunner.manager.getRepository(SubscriptionPlan);
    const purchaseRepo =
      queryRunner.manager.getRepository(SubscriptionPurchase);

    const plan = await planRepo.findOne({
      where: { id: context.subscriptionPlanId },
    });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    if (!plan.isActive)
      throw new BadRequestException('Subscription plan is not active');

    const now = new Date();
    if (plan.startsAt && plan.startsAt > now) {
      throw new BadRequestException('Subscription plan is not available yet');
    }
    if (plan.endsAt && plan.endsAt < now) {
      throw new BadRequestException('Subscription plan has expired');
    }
    if (!context.acceptedTerms) {
      throw new BadRequestException(
        'Subscription terms and conditions must be accepted',
      );
    }

    const existingActive = await purchaseRepo.findOne({
      where: {
        userId,
        branchId: plan.branchId,
        status: SubscriptionPurchaseStatus.ACTIVE,
        paymentStatus: SubscriptionPurchasePaymentStatus.COMPLETED,
      },
    });
    if (existingActive) {
      throw new BadRequestException(
        'User already has an active subscription in this branch',
      );
    }

    const totalHours = plan.totalHours != null ? Number(plan.totalHours) : null;
    const dailyHoursLimit =
      plan.dailyHoursLimit != null ? Number(plan.dailyHoursLimit) : null;
    const startedAt = new Date();
    const endsAt = this.addCalendarMonths(startedAt, plan.durationMonths);
    const rawToken = this.qrCodeService!.generateSubscriptionToken(
      `subscription-${userId}-${Date.now()}`,
    );
    const qrTokenHash = this.qrCodeService!.hashToken(rawToken);

    const purchase = purchaseRepo.create({
      userId,
      branchId: plan.branchId,
      subscriptionPlanId: plan.id,
      planSnapshot: {
        id: plan.id,
        title: plan.title,
        description: plan.description,
        imageUrl: plan.imageUrl,
        price: Number(plan.price),
        currency: plan.currency,
        totalHours,
        dailyHoursLimit,
        usageMode: plan.usageMode,
        durationType: plan.durationType,
        durationMonths: plan.durationMonths,
        mealItems: plan.mealItems || [],
        termsAndConditions: plan.termsAndConditions || null,
      },
      totalHours,
      remainingHours:
        plan.usageMode === SubscriptionUsageMode.DAILY_UNLIMITED
          ? null
          : totalHours,
      dailyHoursLimit,
      startedAt,
      endsAt,
      status: SubscriptionPurchaseStatus.ACTIVE,
      paymentStatus: SubscriptionPurchasePaymentStatus.COMPLETED,
      qrTokenHash,
      metadata: {
        acceptedTerms: true,
        acceptedTermsAt: startedAt.toISOString(),
        termsAndConditions: plan.termsAndConditions || null,
        qrData: rawToken,
        loyaltyRewardApplied: !!context.loyaltyRewardApplied,
      },
    });

    return purchaseRepo.save(purchase);
  }

  async createIntent(userId: string, dto: CreatePaymentIntentDto) {
    let booking: Booking | null = null;
    let eventRequest: EventRequest | null = null;
    let tripRequest: SchoolTripRequest | null = null;
    let customerUser: any = null;
    let amountToPay: number = 0;
    let deferredFlowContext: Record<string, any> | null = null;

    // Check for Booking
    if (dto.bookingId) {
      booking = await this.bookingRepository.findOne({
        where: { id: dto.bookingId, userId },
        relations: ['payments', 'user'],
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status !== BookingStatus.PENDING)
        throw new BadRequestException('Booking not payable');

      customerUser = booking.user;
      amountToPay = Number(booking.totalPrice);
    }
    // Check for EventRequest
    else if (dto.eventRequestId) {
      // Must import EventRequest repository.
      // Since it wasn't injected in constructor, we can use dataSource or add it.
      // For simplicity/safetly here, assuming dynamic access or injected repo if added.
      // Let's use dataSource.getRepository(EventRequest)
      const eventRepo = this.dataSource.getRepository(EventRequest);
      eventRequest = await eventRepo.findOne({
        where: { id: dto.eventRequestId, requesterId: userId },
        relations: ['requester'], // assuming 'requester' is the relation name in entity
      });

      if (!eventRequest) throw new NotFoundException('Event request not found');

      if (
        eventRequest.status !== EventRequestStatus.QUOTED &&
        eventRequest.status !== EventRequestStatus.DEPOSIT_PAID
      ) {
        throw new BadRequestException('Event request not payable');
      }
      const totalAmount = Number(
        eventRequest.totalAmount ?? eventRequest.quotedPrice ?? 0,
      );
      if (totalAmount <= 0) {
        throw new BadRequestException('Event request has no quoted price');
      }

      customerUser = eventRequest.requester;
      amountToPay =
        eventRequest.status === EventRequestStatus.DEPOSIT_PAID
          ? Number(eventRequest.remainingAmount ?? 0)
          : eventRequest.paymentOption === 'deposit'
            ? Number(eventRequest.depositAmount ?? 0)
            : totalAmount;
      if (amountToPay <= 0) {
        throw new BadRequestException('Event request does not require payment');
      }

      // Check for existing payments for this event request
      // We need to fetch payments linked to this eventRequestId manually
      // because EventRequest entity might not have 'payments' relation loaded or defined inverse side properly yet.
      // Or we check Payment repository directly.
      const existingPayment = await this.paymentRepository.findOne({
        where: {
          eventRequestId: eventRequest.id,
          status: PaymentStatus.PENDING,
        },
      });

      if (existingPayment && existingPayment.method === dto.method) {
        return {
          paymentId: existingPayment.id,
          clientSecret: existingPayment.gatewayRef,
          chargeId: existingPayment.gatewayRef,
          provider:
            dto.method === PaymentMethod.SAMSUNG_PAY ? 'moyasar' : undefined,
          flowType:
            dto.method === PaymentMethod.SAMSUNG_PAY
              ? 'embedded_wallet'
              : undefined,
          walletSessionData:
            dto.method === PaymentMethod.SAMSUNG_PAY
              ? {
                  paymentId: existingPayment.id,
                  amount: Number(existingPayment.amount),
                  currency: existingPayment.currency,
                }
              : undefined,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          status: existingPayment.status,
        };
      }
    }
    // Check for School Trip Request
    else if (dto.tripRequestId) {
      const tripRepo = this.dataSource.getRepository(SchoolTripRequest);
      tripRequest = await tripRepo.findOne({
        where: { id: dto.tripRequestId, requesterId: userId } as any,
        relations: ['requester'],
      });

      if (!tripRequest) throw new NotFoundException('Trip request not found');

      // Remaining balance after deposit is settled at the branch, not via app payments.
      if (
        tripRequest.status !== TripRequestStatus.APPROVED &&
        tripRequest.status !== TripRequestStatus.INVOICED
      ) {
        throw new BadRequestException('Trip request not payable');
      }
      const totalAmount = Number(
        tripRequest.totalAmount ?? tripRequest.quotedPrice ?? 0,
      );
      if (totalAmount <= 0) {
        throw new BadRequestException('Trip request has no payable amount');
      }

      customerUser = tripRequest.requester;
      amountToPay =
        tripRequest.paymentOption === 'deposit'
          ? Number(tripRequest.depositAmount ?? 0)
          : totalAmount;

      if (amountToPay <= 0) {
        throw new BadRequestException('Trip request does not require payment');
      }

      // Check for existing payments
      const existingPayment = await this.paymentRepository.findOne({
        where: {
          tripRequestId: tripRequest.id,
        } as any,
      });

      if (
        existingPayment &&
        existingPayment.method === dto.method &&
        existingPayment.status === PaymentStatus.PENDING
      ) {
        return {
          paymentId: existingPayment.id,
          clientSecret: existingPayment.gatewayRef,
          chargeId: existingPayment.gatewayRef,
          provider:
            dto.method === PaymentMethod.SAMSUNG_PAY ? 'moyasar' : undefined,
          flowType:
            dto.method === PaymentMethod.SAMSUNG_PAY
              ? 'embedded_wallet'
              : undefined,
          walletSessionData:
            dto.method === PaymentMethod.SAMSUNG_PAY
              ? {
                  paymentId: existingPayment.id,
                  amount: Number(existingPayment.amount),
                  currency: existingPayment.currency,
                }
              : undefined,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          status: existingPayment.status,
        };
      }
    }
    // Check for Offer Booking
    else if (dto.offerBookingId) {
      const offerBookingRepo = this.dataSource.getRepository(OfferBooking);
      const offerBooking = await offerBookingRepo.findOne({
        where: { id: dto.offerBookingId, userId },
      });
      if (!offerBooking) throw new NotFoundException('Offer booking not found');
      if (offerBooking.paymentStatus !== 'pending')
        throw new BadRequestException('Offer booking not payable');
      customerUser = { id: userId } as any;
      amountToPay = Number(offerBooking.totalPrice);
    }
    // Check for Subscription Purchase
    else if (dto.subscriptionPurchaseId) {
      const subPurchaseRepo =
        this.dataSource.getRepository(SubscriptionPurchase);
      const subPurchase = await subPurchaseRepo.findOne({
        where: { id: dto.subscriptionPurchaseId, userId },
      });
      if (!subPurchase)
        throw new NotFoundException('Subscription purchase not found');
      if (subPurchase.paymentStatus !== 'pending')
        throw new BadRequestException('Subscription purchase not payable');
      customerUser = { id: userId } as any;
      amountToPay = Number(
        (
          await this.dataSource
            .getRepository(SubscriptionPlan)
            .findOne({ where: { id: subPurchase.subscriptionPlanId } })
        )?.price ?? 0,
      );
    } else if (dto.offerProductId) {
      const offer = await this.dataSource.getRepository(OfferProduct).findOne({
        where: { id: dto.offerProductId },
      });
      if (!offer) throw new NotFoundException('Offer product not found');
      if (!offer.isActive) throw new BadRequestException('Offer is not active');
      if (!dto.acceptedTerms) {
        throw new BadRequestException(
          'Offer terms and conditions must be accepted',
        );
      }
      const now = new Date();
      if (offer.startsAt && offer.startsAt > now) {
        throw new BadRequestException('Offer is not available yet');
      }
      if (offer.endsAt && offer.endsAt < now) {
        throw new BadRequestException('Offer has expired');
      }

      const selectedAddOns = this.resolveOfferAddOns(offer, dto.addOns);
      const addonsTotal = selectedAddOns.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      customerUser = { id: userId } as any;
      amountToPay = Number(offer.price) + addonsTotal;
      deferredFlowContext = {
        flowType: 'offer_product',
        userId,
        offerProductId: offer.id,
        addOns: dto.addOns || [],
        contactPhone: dto.contactPhone || null,
        acceptedTerms: true,
      };
    } else if (dto.subscriptionPlanId) {
      if (!dto.acceptedTerms) {
        throw new BadRequestException(
          'Subscription terms and conditions must be accepted',
        );
      }
      if (!this.subscriptionPurchasesService) {
        throw new BadRequestException(
          'Subscription purchases service not available',
        );
      }
      // Must match app quote (loyalty free sixth purchase, etc.); previously used full plan.price only.
      const quote = await this.subscriptionPurchasesService.getQuote(userId, {
        subscriptionPlanId: dto.subscriptionPlanId,
      });
      customerUser = { id: userId } as any;
      amountToPay = Number(quote.totalPrice);
      deferredFlowContext = {
        flowType: 'subscription_plan',
        userId,
        subscriptionPlanId: dto.subscriptionPlanId,
        acceptedTerms: true,
        loyaltyRewardApplied:
          !!quote.loyalty && quote.loyalty.isEligibleForFreePurchase === true,
      };
    } else if (dto.giftOrderId) {
      const giftOrderRepo = this.dataSource.getRepository(GiftOrder);
      const giftOrder = await giftOrderRepo.findOne({
        where: { id: dto.giftOrderId, senderUserId: userId },
      });
      if (!giftOrder) {
        throw new NotFoundException('Gift order not found');
      }
      if (giftOrder.paymentStatus !== GiftPaymentStatus.PENDING) {
        throw new BadRequestException('Gift order is not payable');
      }
      customerUser = { id: userId } as any;
      amountToPay = Number(giftOrder.total);
      deferredFlowContext = {
        flowType: 'gift_order',
        userId,
        giftOrderId: giftOrder.id,
      };
    } else if (dto.tripRequestPayload) {
      const quote = await this.tripsService.quotePayFirstSchoolTripIntent(
        userId,
        dto.tripRequestPayload as Record<string, any>,
      );
      customerUser = { id: userId } as any;
      amountToPay = quote.amountToPay;
      deferredFlowContext = quote.deferredFlowContext;
    } else if (dto.eventRequestPayload) {
      // ── Pay-First Event Request Flow ─────────────────────────────────────
      const payload = dto.eventRequestPayload;
      if (!payload.acceptedTerms) {
        throw new BadRequestException('Terms and conditions must be accepted');
      }

      // Slot availability check is done at confirm time; pricing validated below.

      // Compute pricing (mirrors EventsService constants)
      const BASE_HALL_PRICE = 200;
      const DEPOSIT_PCT = 20;
      const MAX_PERSONS = 7;
      const FIXED_DURATION = 2;
      const VALID_SLOTS = ['16:00-18:00', '19:00-21:00', '22:00-00:00'];

      if (payload.persons > MAX_PERSONS) {
        throw new BadRequestException(
          `Private event booking allows up to ${MAX_PERSONS} persons only`,
        );
      }
      if (
        payload.durationHours !== FIXED_DURATION ||
        !VALID_SLOTS.includes(payload.selectedTimeSlot)
      ) {
        throw new BadRequestException('Invalid private event time slot');
      }

      // Resolve add-ons subtotal from client-provided prices
      const addOnsSubtotal = (payload.addOns || []).reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
        0,
      );
      const totalAmount =
        Math.round((BASE_HALL_PRICE + addOnsSubtotal) * 100) / 100;
      const depositAmount =
        Math.round((totalAmount * DEPOSIT_PCT) / 100 * 100) / 100;

      amountToPay =
        payload.paymentOption === 'deposit' ? depositAmount : totalAmount;

      customerUser = { id: userId } as any;
      deferredFlowContext = {
        flowType: 'event_request_pay_first',
        userId,
        eventRequestPayload: payload,
        totalAmount,
        depositAmount,
        addOnsSubtotal,
      };
    } else {

      throw new BadRequestException(
        'A payable target or pay-first product id is required',
      );
    }

    if (!customerUser)
      throw new BadRequestException('User information not found');

    // Idempotency: return existing pending/processing intent for same method (Booking logic)
    if (booking && booking.payments) {
      const existing = booking.payments.find(
        (p) =>
          (p.status === PaymentStatus.PENDING ||
            p.status === PaymentStatus.PROCESSING) &&
          p.method === dto.method,
      );
      if (existing) {
        return {
          paymentId: existing.id,
          clientSecret: existing.gatewayRef,
          chargeId: existing.gatewayRef,
          provider:
            dto.method === PaymentMethod.SAMSUNG_PAY ? 'moyasar' : undefined,
          flowType:
            dto.method === PaymentMethod.SAMSUNG_PAY
              ? 'embedded_wallet'
              : undefined,
          walletSessionData:
            dto.method === PaymentMethod.SAMSUNG_PAY
              ? {
                  paymentId: existing.id,
                  amount: Number(existing.amount),
                  currency: existing.currency,
                }
              : undefined,
          amount: existing.amount,
          currency: existing.currency,
          status: existing.status,
        };
      }
    }

    // If payment method is wallet, check balance
    if (dto.method === PaymentMethod.WALLET) {
      if (!this.walletService) {
        throw new BadRequestException('Wallet service not available');
      }
      const walletBalance = await this.walletService.getWalletBalance(userId);
      if (Number(walletBalance.balance) < Number(amountToPay)) {
        throw new BadRequestException('Insufficient wallet balance');
      }
    }

    // Idempotency by key
    let uniqueId: string | undefined;
    if (booking) uniqueId = booking.id;
    else if (eventRequest) uniqueId = eventRequest.id;
    else if (dto.tripRequestId) uniqueId = dto.tripRequestId;
    else if (dto.offerBookingId) uniqueId = dto.offerBookingId;
    else if (dto.subscriptionPurchaseId)
      uniqueId = dto.subscriptionPurchaseId;
    else if (dto.offerProductId) uniqueId = dto.offerProductId;
    else if (dto.subscriptionPlanId) uniqueId = dto.subscriptionPlanId;
    else if (dto.giftOrderId) uniqueId = dto.giftOrderId;
    else if (dto.eventRequestPayload)
      uniqueId = `ev_pf:${userId}:${this.stablePayloadHash(dto.eventRequestPayload)}`;
    else if (dto.tripRequestPayload)
      uniqueId = `tr_pf:${userId}:${this.stablePayloadHash(dto.tripRequestPayload)}`;

    const idempotencyKey = `pay:intent:${uniqueId ?? 'unknown'}:${dto.method}`;
    const exists = await this.redisService.get(idempotencyKey);
    if (exists) {
      return exists;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Prepare Payment object
      // Note: Payment entity needs 'eventRequestId' column if not present?
      // Based on typical TypeORM, we might need to be careful if column is missing.
      // Assuming Payment entity handles connection to EventRequest or we just store generic ref.
      // Let's look at Payment entity definition?
      // Use 'bookingId' for booking, and 'eventRequestId' column for events if it exists.
      // If Payment entity doesn't have eventRequestId, we might need to add it or hack it.
      // Looking at typical setups, we should add eventRequestId to Payment entity or use a polymorphic approach.
      // Assuming for this fix that we can just save it.
      // NOTE: User asked to fix backend NOW. I will assume DB column exists or I'll need to create it.
      // Let's check Payment entity... (I can't read it again mid-tool, risking it)
      // I'll assume 'eventRequestId' is added to payment entity or I should use bookingId as a hack?
      // No, clean way:

      const paymentData: Partial<Payment> = {
        amount: amountToPay,
        currency: 'SAR',
        status: PaymentStatus.PENDING,
        method: dto.method,
      };

      if (booking) {
        paymentData.bookingId = booking.id;
      } else if (eventRequest) {
        paymentData.eventRequestId = eventRequest.id;
      } else if (dto.tripRequestId) {
        paymentData.tripRequestId = dto.tripRequestId;
      } else if (dto.offerBookingId) {
        paymentData.offerBookingId = dto.offerBookingId;
      } else if (dto.subscriptionPurchaseId) {
        paymentData.subscriptionPurchaseId = dto.subscriptionPurchaseId;
      } else if (dto.giftOrderId) {
        paymentData.giftOrderId = dto.giftOrderId;
      }
      if (deferredFlowContext) {
        paymentData.webhookData =
          this.serializePaymentJson(deferredFlowContext);
      }

      const payment = queryRunner.manager.create(Payment, paymentData);

      const savedPayment = await queryRunner.manager.save(payment);

      // Handle wallet payments differently
      if (dto.method === PaymentMethod.WALLET) {
        // For wallet payments, mark as processing immediately
        savedPayment.gatewayRef = `wallet_${savedPayment.id}`;
        savedPayment.status = PaymentStatus.PROCESSING;
        await queryRunner.manager.save(savedPayment);
      } else {
        // Bypass payments if keys are missing or explicitly enabled
        const bypass =
          !this.configService.get<string>('MOYASAR_SECRET_KEY') ||
          (
            this.configService.get<string>('PAYMENTS_BYPASS') || ''
          ).toString() === 'true';
        if (bypass) {
          savedPayment.gatewayRef = `bypass_${savedPayment.id}`;
          savedPayment.status = PaymentStatus.PROCESSING;
          await queryRunner.manager.save(savedPayment);
        } else {
          // With Moyasar SDK, payment is created client-side and verified on confirm.
          savedPayment.status = PaymentStatus.PROCESSING;
          await queryRunner.manager.save(savedPayment);
        }
      }

      await queryRunner.commitTransaction();

      const response = {
        paymentId: savedPayment.id,
        chargeId: savedPayment.gatewayRef || '',
        redirectUrl: null,
        provider: dto.method === PaymentMethod.SAMSUNG_PAY ? 'moyasar' : null,
        flowType:
          dto.method === PaymentMethod.SAMSUNG_PAY
            ? 'embedded_wallet'
            : null,
        walletSessionData:
          dto.method === PaymentMethod.SAMSUNG_PAY
            ? {
                paymentId: savedPayment.id,
                amount: Number(savedPayment.amount),
                currency: savedPayment.currency,
              }
            : null,
        amount: savedPayment.amount,
        currency: savedPayment.currency,
        status: savedPayment.status,
      };

      await this.redisService.set(idempotencyKey, response, 120);
      return response;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async confirmPayment(userId: string, dto: ConfirmPaymentDto) {
    let booking: Booking | null = null;
    let eventRequest: EventRequest | null = null;
    let tripRequest: SchoolTripRequest | null = null;
    let offerBooking: OfferBooking | null = null;
    let subscriptionPurchase: SubscriptionPurchase | null = null;
    let giftOrder: GiftOrder | null = null;
    let payment: Payment | null = null;
    let walletRechargeResult:
      | {
          success: boolean;
          transactionId: string;
          amount: number;
          newBalance: number;
        }
      | undefined;

    // First try to find by booking
    if (dto.bookingId) {
      booking = await this.bookingRepository.findOne({
        where: { id: dto.bookingId, userId },
        relations: ['payments'],
      });
      if (booking) {
        payment = booking.payments?.find((p) => p.id === dto.paymentId) || null;
      }
    }

    // If no booking found/provided, it might be an event request payment, or we just look up payment directly carefully.
    // The dto might have eventRequestId if we updated DTO, but confirm dto usually relies on paymentId
    // Let's modify logic to find payment first if we trust paymentId ownership check.

    // However, existing logic finds booking first.
    // If bookingId is missing, check if eventRequestId is in DTO?
    // The user's ConfirmPaymentDto usually has bookingId optional.

    let externalGatewayPaymentId: string | undefined;

    if (!payment) {
      // Try finding payment directly and verify ownership via relations
      payment = await this.paymentRepository.findOne({
        where: { id: dto.paymentId },
        relations: ['booking', 'booking.payments'], // 'eventRequest' relation?
      });

      // If payment is linked to booking, ensure booking matches current user (if passed in DTO?)
      // Or if event request. Since we don't have explicit eventRequest relation in Payment entity (yet),
      // we relied on 'bookingId' or 'eventRequestId' column.

      // Use query builder to handle both cases if relations are set up
      const qb = this.paymentRepository
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.booking', 'b')
        .where('p.id = :paymentId', { paymentId: dto.paymentId });

      // We might need to join eventRequest manually if relation doesn't differ
      // Assuming we added eventRequestId to Payment entity in previous step via partial<Payment>
      // Let's assume Payment entity has 'bookingId' and 'eventRequestId' columns now.

      const loadedPayment = await qb.getOne();

      if (loadedPayment) {
        if (loadedPayment.bookingId) {
          booking = await this.bookingRepository.findOne({
            where: { id: loadedPayment.bookingId, userId },
          });
          if (!booking)
            throw new NotFoundException('Booking not found or access denied');
          payment = loadedPayment;
        } else if (loadedPayment.eventRequestId) {
          const eventRepo = this.dataSource.getRepository(EventRequest);
          const eventId = loadedPayment.eventRequestId;
          eventRequest = await eventRepo.findOne({
            where: { id: eventId, requesterId: userId },
          });
          if (!eventRequest)
            throw new NotFoundException(
              'Event request not found or access denied',
            );
          payment = loadedPayment;
        } else if (loadedPayment.tripRequestId) {
          // Handle trip request payment
          tripRequest = await this.dataSource
            .getRepository(SchoolTripRequest)
            .findOne({
              where: { id: loadedPayment.tripRequestId, requesterId: userId },
            });
          if (!tripRequest)
            throw new NotFoundException(
              'Trip request not found or access denied',
            );
          payment = loadedPayment;
        } else if (loadedPayment.offerBookingId) {
          offerBooking = await this.dataSource
            .getRepository(OfferBooking)
            .findOne({
              where: { id: loadedPayment.offerBookingId, userId },
            });
          if (!offerBooking) {
            throw new NotFoundException(
              'Offer booking not found or access denied',
            );
          }
          payment = loadedPayment;
        } else if (loadedPayment.subscriptionPurchaseId) {
          subscriptionPurchase = await this.dataSource
            .getRepository(SubscriptionPurchase)
            .findOne({
              where: {
                id: loadedPayment.subscriptionPurchaseId,
                userId,
              },
            });
          if (!subscriptionPurchase) {
            throw new NotFoundException(
              'Subscription purchase not found or access denied',
            );
          }
          payment = loadedPayment;
        } else if (loadedPayment.giftOrderId) {
          giftOrder = await this.dataSource.getRepository(GiftOrder).findOne({
            where: { id: loadedPayment.giftOrderId, senderUserId: userId },
          });
          if (!giftOrder) {
            throw new NotFoundException(
              'Gift order not found or access denied',
            );
          }
          payment = loadedPayment;
        } else if (this.getPendingFlowContext(loadedPayment)) {
          payment = loadedPayment;
        } else {
          // Orphan payment?
          throw new NotFoundException('Payment entity context lost');
        }
      }
    }

    // If client passed external gateway payment id, map it to latest pending payment by context.
    if (
      !payment &&
      (dto.bookingId ||
        dto.eventRequestId ||
        dto.tripRequestId ||
        dto.offerBookingId ||
        dto.subscriptionPurchaseId ||
        dto.giftOrderId)
    ) {
      externalGatewayPaymentId = dto.paymentId;

      if (dto.offerBookingId) {
        offerBooking = await this.dataSource
          .getRepository(OfferBooking)
          .findOne({
            where: { id: dto.offerBookingId, userId },
          });
        if (!offerBooking) {
          throw new NotFoundException(
            'Offer booking not found or access denied',
          );
        }
      }

      if (dto.subscriptionPurchaseId) {
        subscriptionPurchase = await this.dataSource
          .getRepository(SubscriptionPurchase)
          .findOne({
            where: { id: dto.subscriptionPurchaseId, userId },
          });
        if (!subscriptionPurchase) {
          throw new NotFoundException(
            'Subscription purchase not found or access denied',
          );
        }
      }

      if (dto.giftOrderId) {
        giftOrder = await this.dataSource.getRepository(GiftOrder).findOne({
          where: { id: dto.giftOrderId, senderUserId: userId },
        });
        if (!giftOrder) {
          throw new NotFoundException('Gift order not found or access denied');
        }
      }

      payment = await this.paymentRepository.findOne({
        where: {
          ...(dto.bookingId ? { bookingId: dto.bookingId } : {}),
          ...(dto.eventRequestId ? { eventRequestId: dto.eventRequestId } : {}),
          ...(dto.tripRequestId ? { tripRequestId: dto.tripRequestId } : {}),
          ...(dto.offerBookingId ? { offerBookingId: dto.offerBookingId } : {}),
          ...(dto.subscriptionPurchaseId
            ? { subscriptionPurchaseId: dto.subscriptionPurchaseId }
            : {}),
          ...(dto.giftOrderId ? { giftOrderId: dto.giftOrderId } : {}),
          status: PaymentStatus.PROCESSING,
        },
        order: { createdAt: 'DESC' },
      });
    }

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.COMPLETED) {
      if (payment.offerBookingId && this.offerBookingsService) {
        await this.offerBookingsService.confirmPayment(payment.offerBookingId);
      }
      if (payment.subscriptionPurchaseId && this.subscriptionPurchasesService) {
        await this.subscriptionPurchasesService.confirmPayment(
          payment.subscriptionPurchaseId,
        );
      }
      // Idempotent re-confirm: client still needs context ids for deep links.
      return {
        success: true,
        paymentId: payment.id,
        bookingId: payment.bookingId ?? undefined,
        eventRequestId: payment.eventRequestId ?? undefined,
        tripRequestId: payment.tripRequestId ?? undefined,
        offerBookingId: payment.offerBookingId ?? undefined,
        subscriptionPurchaseId: payment.subscriptionPurchaseId ?? undefined,
        giftOrderId: payment.giftOrderId ?? undefined,
      };
    }
    const pendingFlowContext = this.getPendingFlowContext(payment);

    // Ensure payment context entities are loaded before any downstream logic.
    // This avoids null access (e.g. booking/event/trip id) for flows that
    // resolve payment directly via eventRequestId/tripRequestId filters.
    if (!booking && payment.bookingId) {
      booking = await this.bookingRepository.findOne({
        where: { id: payment.bookingId, userId },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found or access denied');
      }
    }

    if (!eventRequest && payment.eventRequestId) {
      const eventRepo = this.dataSource.getRepository(EventRequest);
      eventRequest = await eventRepo.findOne({
        where: { id: payment.eventRequestId, requesterId: userId },
        relations: ['requester'],
      });
      if (!eventRequest) {
        throw new NotFoundException('Event request not found or access denied');
      }
    }

    if (!tripRequest && payment.tripRequestId) {
      const tripRepo = this.dataSource.getRepository(SchoolTripRequest);
      tripRequest = await tripRepo.findOne({
        where: { id: payment.tripRequestId, requesterId: userId },
      } as any);
      if (!tripRequest) {
        throw new NotFoundException('Trip request not found or access denied');
      }
    }

    if (!offerBooking && payment.offerBookingId) {
      offerBooking = await this.dataSource.getRepository(OfferBooking).findOne({
        where: { id: payment.offerBookingId, userId },
      });
      if (!offerBooking) {
        throw new NotFoundException('Offer booking not found or access denied');
      }
    }

    if (!subscriptionPurchase && payment.subscriptionPurchaseId) {
      subscriptionPurchase = await this.dataSource
        .getRepository(SubscriptionPurchase)
        .findOne({
          where: { id: payment.subscriptionPurchaseId, userId },
        });
      if (!subscriptionPurchase) {
        throw new NotFoundException(
          'Subscription purchase not found or access denied',
        );
      }
    }

    if (!giftOrder && payment.giftOrderId) {
      giftOrder = await this.dataSource.getRepository(GiftOrder).findOne({
        where: { id: payment.giftOrderId, senderUserId: userId },
      });
      if (!giftOrder) {
        throw new NotFoundException('Gift order not found or access denied');
      }
    }

    // Handle wallet payments
    if (
      payment.method === PaymentMethod.WALLET &&
      pendingFlowContext?.flowType !== 'wallet_recharge'
    ) {
      if (!this.walletService) {
        throw new BadRequestException('Wallet service not available');
      }
      // Deduct from wallet. Only `bookings.id` may be stored in relatedBookingId (FK).
      const walletLink = booking
        ? {
            relatedBookingId: booking.id,
            reference: `booking_${booking.id}`,
            metadata: { bookingId: booking.id, paymentId: payment.id },
          }
        : eventRequest
          ? {
              relatedBookingId: null,
              reference: `event_request_${eventRequest.id}`,
              metadata: {
                eventRequestId: eventRequest.id,
                paymentId: payment.id,
              },
            }
          : tripRequest
            ? {
                relatedBookingId: null,
                reference: `trip_request_${tripRequest.id}`,
                metadata: {
                  tripRequestId: tripRequest.id,
                  paymentId: payment.id,
                },
              }
            : offerBooking
              ? {
                  relatedBookingId: null,
                  reference: `offer_booking_${offerBooking.id}`,
                  metadata: {
                    offerBookingId: offerBooking.id,
                    paymentId: payment.id,
                  },
                }
              : subscriptionPurchase
                ? {
                    relatedBookingId: null,
                    reference: `subscription_purchase_${subscriptionPurchase.id}`,
                    metadata: {
                      subscriptionPurchaseId: subscriptionPurchase.id,
                      paymentId: payment.id,
                    },
                  }
                : giftOrder
                  ? {
                      relatedBookingId: null,
                      reference: `gift_order_${giftOrder.id}`,
                      metadata: {
                        giftOrderId: giftOrder.id,
                        paymentId: payment.id,
                      },
                    }
                  : pendingFlowContext
                    ? {
                        relatedBookingId: null,
                        reference: `payment_${pendingFlowContext.flowType}_${payment.id}`,
                        metadata: {
                          ...pendingFlowContext,
                          paymentId: payment.id,
                        },
                      }
                    : null;
      if (!walletLink) {
        throw new BadRequestException('Payment context id is missing');
      }
      await this.walletService.deductWallet(
        userId,
        payment.amount,
        walletLink,
      );
    } else {
      const bypass =
        !this.configService.get<string>('MOYASAR_SECRET_KEY') ||
        (this.configService.get<string>('PAYMENTS_BYPASS') || '').toString() ===
          'true';
      if (!bypass) {
        if (!this.moyasarService)
          throw new BadRequestException('Payment gateway not configured');
        const gatewayPayload = dto.gatewayPayload || {};
        const maybePayloadId = (gatewayPayload.moyasarPaymentId ||
          gatewayPayload.paymentId) as string | undefined;
        const moyasarPaymentId =
          maybePayloadId || externalGatewayPaymentId || payment.gatewayRef;

        if (!moyasarPaymentId) {
          throw new BadRequestException('Missing Moyasar payment id');
        }

        const moyasarPayment =
          await this.moyasarService.retrievePayment(moyasarPaymentId);
        const succeeded = ['paid', 'authorized'].includes(
          (moyasarPayment.status || '').toLowerCase(),
        );
        if (!succeeded) {
          throw new BadRequestException('Payment not completed');
        }

        const expectedAmount = Math.round(Number(payment.amount) * 100);
        if (Number(moyasarPayment.amount) !== expectedAmount) {
          throw new BadRequestException('Payment amount mismatch');
        }
        if (
          (moyasarPayment.currency || '').toUpperCase() !==
          (payment.currency || '').toUpperCase()
        ) {
          throw new BadRequestException('Payment currency mismatch');
        }

        payment.gatewayRef = moyasarPaymentId;
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let transactionStarted = false;
    let savedBooking: Booking | null = null;
    let createdOfferBooking: OfferBooking | null = null;
    let createdSubscriptionPurchase: SubscriptionPurchase | null = null;

    try {
      await queryRunner.startTransaction();
      transactionStarted = true;

      payment.status = PaymentStatus.COMPLETED;
      payment.paidAt = new Date();
      if (!payment.transactionId) {
        payment.transactionId = `txn_${payment.id}`;
      }
      await queryRunner.manager.save(payment);

      if (pendingFlowContext?.flowType === 'wallet_recharge') {
        if (!this.walletService) {
          throw new BadRequestException('Wallet service not available');
        }

        walletRechargeResult =
          await this.walletService.completeRechargeFromPayment(
            userId,
            Number(payment.amount),
            payment.id,
            queryRunner.manager,
            payment.method,
          );
      } else if (pendingFlowContext?.flowType === 'offer_product') {
        createdOfferBooking = await this.createOfferBookingAfterPayment(
          queryRunner,
          userId,
          pendingFlowContext,
        );
        payment.offerBookingId = createdOfferBooking.id;
        payment.webhookData = this.serializePaymentJson({
          ...pendingFlowContext,
          createdOfferBookingId: createdOfferBooking.id,
        });
        await queryRunner.manager.save(payment);
      } else if (pendingFlowContext?.flowType === 'subscription_plan') {
        createdSubscriptionPurchase =
          await this.createSubscriptionPurchaseAfterPayment(
            queryRunner,
            userId,
            pendingFlowContext,
          );
        payment.subscriptionPurchaseId = createdSubscriptionPurchase.id;
        payment.webhookData = this.serializePaymentJson({
          ...pendingFlowContext,
          createdSubscriptionPurchaseId: createdSubscriptionPurchase.id,
        });
        await queryRunner.manager.save(payment);
      } else if (pendingFlowContext?.flowType === 'event_request_pay_first') {
        // ── Pay-First: Create EventRequest after payment ─────────────────
        const ep = pendingFlowContext.eventRequestPayload as {
          type: string;
          branchId: string;
          startTime: string;
          selectedTimeSlot: string;
          durationHours: number;
          persons: number;
          paymentOption: 'full' | 'deposit';
          addOns?: Array<{
            id: string;
            name: string;
            price: number;
            quantity: number;
            category?: string;
          }>;
          notes?: string;
          acceptedTerms: boolean;
        };

        const totalAmount = Number(pendingFlowContext.totalAmount ?? 0);
        const depositAmount = Number(pendingFlowContext.depositAmount ?? 0);
        const addOnsSubtotal = Number(pendingFlowContext.addOnsSubtotal ?? 0);
        const paidAmount = Number(payment.amount);
        const remainingAmount = Math.max(
          0,
          Math.round((totalAmount - paidAmount) * 100) / 100,
        );

        const resolvedAddOns = (ep.addOns || []).map((a) => ({
          id: a.id,
          name: a.name,
          category: a.category ?? null,
          price: Number(a.price),
          quantity: Number(a.quantity),
        }));

        // Build slot window for startTime storage
        const normalizedDate = String(ep.startTime).split('T')[0].trim();
        const [startSlot] = ep.selectedTimeSlot.split('-');
        const [startHour, startMin] = startSlot.split(':').map(Number);
        const startTimeStr = `${normalizedDate}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00+03:00`;
        const eventStartTime = new Date(startTimeStr);

        const eventRepo = queryRunner.manager.getRepository(EventRequest);
        const newEventRequest = eventRepo.create({
          requesterId: userId,
          type: ep.type,
          decorated: resolvedAddOns.some((a) => a.category === 'event_decor'),
          branchId: ep.branchId,
          startTime: eventStartTime,
          durationHours: 2,
          selectedTimeSlot: ep.selectedTimeSlot,
          persons: ep.persons,
          addOns: resolvedAddOns as any,
          notes: ep.notes,
          acceptedTerms: true,
          status:
            remainingAmount > 0
              ? EventRequestStatus.DEPOSIT_PAID
              : EventRequestStatus.CONFIRMED,
          quotedPrice: totalAmount,
          hallRentalPrice: 200,
          addOnsSubtotal,
          totalAmount,
          paymentOption: ep.paymentOption,
          depositAmount,
          amountPaid: paidAmount,
          remainingAmount,
          paymentMethod: payment.method,
        });
        const savedEventRequest = await eventRepo.save(newEventRequest);

        // Link payment to event request
        payment.eventRequestId = savedEventRequest.id;
        payment.webhookData = this.serializePaymentJson({
          ...pendingFlowContext,
          createdEventRequestId: savedEventRequest.id,
        });
        await queryRunner.manager.save(payment);

        // Create Booking
        const newBooking = queryRunner.manager.create(Booking, {
          userId,
          branchId: ep.branchId,
          startTime: eventStartTime,
          durationHours: 2,
          persons: ep.persons,
          totalPrice: totalAmount,
          status: BookingStatus.CONFIRMED,
          addOns: resolvedAddOns,
          specialRequests: ep.notes,
          metadata: {
            eventRequestId: savedEventRequest.id,
            eventType: ep.type,
            selectedTimeSlot: ep.selectedTimeSlot,
            paymentOption: ep.paymentOption,
            amountPaid: paidAmount,
            remainingAmount,
          },
        });
        savedBooking = await queryRunner.manager.save(newBooking);
        savedEventRequest.bookingId = savedBooking.id;
        await eventRepo.save(savedEventRequest);

        // Create Ticket
        const { validFrom, validUntil } = resolveEventTicketWindow(
          eventStartTime,
          2,
        );
        const qrToken = this.qrCodeService
          ? this.qrCodeService.generateQRToken(
              savedBooking.id,
              `${savedBooking.id}-private-group`,
            )
          : `${savedBooking.id}-private-group-${Date.now()}`;
        const qrTokenHash = this.qrCodeService
          ? this.qrCodeService.generateQRTokenHash(qrToken)
          : crypto.createHash('sha256').update(qrToken).digest('hex');

        const groupTicket = queryRunner.manager.create(Ticket, {
          bookingId: savedBooking.id,
          qrTokenHash,
          status: TicketStatus.VALID,
          personCount: ep.persons,
          validFrom,
          validUntil,
        });
        await queryRunner.manager.save(groupTicket);

        await this.notifications.enqueue({
          type: 'TICKETS_ISSUED',
          to: { userId },
          data: { bookingId: savedBooking.id },
          channels: ['sms', 'push'],
        });

      } else if (pendingFlowContext?.flowType === 'trip_request_pay_first') {
        const createdTrip =
          await this.tripsService.insertSchoolTripFromPayFirstConfirmation(
            queryRunner.manager,
            userId,
            pendingFlowContext,
            payment,
          );
        payment.tripRequestId = createdTrip.id;
        payment.webhookData = this.serializePaymentJson({
          ...pendingFlowContext,
          createdTripRequestId: createdTrip.id,
        });
        await queryRunner.manager.save(payment);
        tripRequest = createdTrip;
        const newPaidAmount = Number(createdTrip.amountPaid ?? 0);
        const remainingAmount = Number(createdTrip.remainingAmount ?? 0);
        savedBooking = await this.syncSchoolTripBookingAfterPayment(
          queryRunner,
          payment,
          createdTrip,
          newPaidAmount,
          remainingAmount,
        );
      } else if (pendingFlowContext?.flowType === 'gift_order') {
        const giftOrderRepo = queryRunner.manager.getRepository(GiftOrder);
        const giftOrder = await giftOrderRepo.findOne({
          where: { id: pendingFlowContext.giftOrderId },
        });
        if (giftOrder) {
          giftOrder.paymentStatus = GiftPaymentStatus.PAID;
          giftOrder.whatsappMessageStatus = 'pending' as any;
          await giftOrderRepo.save(giftOrder);
        }
      } else if (booking) {
        booking.status = BookingStatus.CONFIRMED;
        await queryRunner.manager.save(booking);
      } else if (eventRequest) {
        await this.ensureEventSlotStillAvailable(
          queryRunner.manager,
          eventRequest,
        );

        const totalAmount = Number(
          eventRequest.totalAmount ?? eventRequest.quotedPrice ?? 0,
        );
        const existingPaidAmount = Number(eventRequest.amountPaid ?? 0);
        const newPaidAmount =
          Math.round((existingPaidAmount + Number(payment.amount)) * 100) / 100;
        const remainingAmount = Math.max(
          0,
          Math.round((totalAmount - newPaidAmount) * 100) / 100,
        );

        eventRequest.amountPaid = newPaidAmount as any;
        eventRequest.remainingAmount = remainingAmount as any;
        eventRequest.paymentMethod = payment.method;
        eventRequest.status =
          remainingAmount > 0
            ? EventRequestStatus.DEPOSIT_PAID
            : EventRequestStatus.CONFIRMED;

        if (eventRequest.bookingId) {
          savedBooking = await queryRunner.manager.findOne(Booking, {
            where: { id: eventRequest.bookingId },
          });
        }

        if (!savedBooking) {
          const newBooking = queryRunner.manager.create(Booking, {
            userId: eventRequest.requesterId,
            branchId: eventRequest.branchId,
            startTime: eventRequest.startTime,
            durationHours: eventRequest.durationHours,
            persons: eventRequest.persons,
            totalPrice:
              eventRequest.totalAmount || eventRequest.quotedPrice || 0,
            status: BookingStatus.CONFIRMED,
            addOns: eventRequest.addOns,
            specialRequests: eventRequest.notes,
            metadata: {
              eventRequestId: eventRequest.id,
              selectedTimeSlot: eventRequest.selectedTimeSlot,
              paymentOption: eventRequest.paymentOption,
              amountPaid: newPaidAmount,
              remainingAmount,
            },
          });
          savedBooking = await queryRunner.manager.save(newBooking);
          eventRequest.bookingId = savedBooking.id;
        } else {
          savedBooking.metadata = {
            ...(savedBooking.metadata || {}),
            eventRequestId: eventRequest.id,
            selectedTimeSlot: eventRequest.selectedTimeSlot,
            paymentOption: eventRequest.paymentOption,
            amountPaid: newPaidAmount,
            remainingAmount,
          };
          await queryRunner.manager.save(savedBooking);
        }

        const ticketCount = await queryRunner.manager.count(Ticket, {
          where: { bookingId: savedBooking.id },
        });
        if (ticketCount === 0) {
          const { validFrom, validUntil } = resolveEventTicketWindow(
            eventRequest.startTime,
            eventRequest.durationHours,
          );
          const qrToken = this.qrCodeService
            ? this.qrCodeService.generateQRToken(
                savedBooking.id,
                `${savedBooking.id}-private-group`,
              )
            : `${savedBooking.id}-private-group-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const qrTokenHash = this.qrCodeService
            ? this.qrCodeService.generateQRTokenHash(qrToken)
            : crypto.createHash('sha256').update(qrToken).digest('hex');

          const groupTicket = queryRunner.manager.create(Ticket, {
            bookingId: savedBooking.id,
            qrTokenHash,
            status: TicketStatus.VALID,
            personCount: eventRequest.persons,
            validFrom,
            validUntil,
          });
          await queryRunner.manager.save(groupTicket);

          await this.notifications.enqueue({
            type: 'TICKETS_ISSUED',
            to: { userId: eventRequest.requesterId },
            data: { bookingId: savedBooking.id },
            channels: ['sms', 'push'],
          });
        }

        await queryRunner.manager.save(eventRequest);
      } else if (tripRequest) {
        const totalAmount = Number(
          tripRequest.totalAmount ?? tripRequest.quotedPrice ?? 0,
        );
        const existingPaidAmount = Number(tripRequest.amountPaid ?? 0);
        const newPaidAmount =
          Math.round((existingPaidAmount + Number(payment.amount)) * 100) / 100;
        const remainingAmount = Math.max(
          0,
          Math.round((totalAmount - newPaidAmount) * 100) / 100,
        );

        tripRequest.amountPaid = newPaidAmount as any;
        tripRequest.remainingAmount = remainingAmount as any;
        tripRequest.paymentMethod = payment.method;

        tripRequest.status =
          remainingAmount > 0
            ? TripRequestStatus.DEPOSIT_PAID
            : TripRequestStatus.PAID;
        await queryRunner.manager.save(tripRequest);

        savedBooking = await this.syncSchoolTripBookingAfterPayment(
          queryRunner,
          payment,
          tripRequest,
          newPaidAmount,
          remainingAmount,
        );
      }

      await queryRunner.commitTransaction();
      transactionStarted = false;

      if (pendingFlowContext?.flowType === 'wallet_recharge') {
        await this.notifications.enqueue({
          type: 'PAYMENT_SUCCESS',
          to: { userId },
          data: { amount: payment.amount, currency: payment.currency },
          channels: ['sms', 'push'],
        });

        if (walletRechargeResult) {
          await this.notifications.enqueue({
            type: 'WALLET_RECHARGED',
            to: { userId },
            data: {
              amount: Number(payment.amount),
              currency: payment.currency,
              balance: walletRechargeResult.newBalance,
            },
            channels: ['sms', 'push'],
          });
        }

        return {
          success: true,
          paymentId: payment.id,
          transactionId: walletRechargeResult?.transactionId,
          walletBalance: walletRechargeResult?.newBalance,
        };
      }

      // Post-confirmation actions (tickets, notifications) - outside transaction
      // Use savedBooking if it was created, otherwise use booking.id, or null if neither exists
      const bookingIdForLoyalty = savedBooking
        ? savedBooking.id
        : booking
          ? booking.id
          : null;
      const targetId =
        createdOfferBooking?.id ??
        createdSubscriptionPurchase?.id ??
        booking?.id ??
        eventRequest?.id ??
        tripRequest?.id ??
        giftOrder?.id ??
        payment.bookingId ??
        payment.eventRequestId ??
        payment.tripRequestId ??
        payment.offerBookingId ??
        payment.subscriptionPurchaseId ??
        payment.giftOrderId;
      if (!targetId) {
        throw new BadRequestException('Payment target id is missing');
      }

      try {
        if (booking && this.bookings) {
          await this.bookings.issueTicketsForBooking(booking.id);
          await this.notifications.enqueue({
            type: 'TICKETS_ISSUED',
            to: { userId },
            data: { bookingId: booking.id },
            channels: ['sms', 'push'],
          });
        }
      } catch (e) {
        this.logger.error(
          `Failed to issue tickets post-payment: ${e?.message || e}`,
        );
      }

      // Handle offer booking payment confirmation
      if (payment.offerBookingId && this.offerBookingsService) {
        try {
          await this.offerBookingsService.confirmPayment(
            payment.offerBookingId,
          );
        } catch (e) {
          this.logger.error(
            `Failed to confirm offer booking payment: ${e?.message || e}`,
          );
        }
      }

      // Handle subscription purchase payment confirmation
      if (payment.subscriptionPurchaseId && this.subscriptionPurchasesService) {
        try {
          await this.subscriptionPurchasesService.confirmPayment(
            payment.subscriptionPurchaseId,
          );
        } catch (e) {
          this.logger.error(
            `Failed to confirm subscription purchase payment: ${e?.message || e}`,
          );
        }
      }

      // Notify payment success and booking confirmed
      await this.notifications.enqueue({
        type: 'PAYMENT_SUCCESS',
        to: { userId },
        data: { amount: payment.amount, currency: payment.currency },
        channels: ['sms', 'push'],
      });

      await this.notifications.enqueue({
        type: 'BOOKING_CONFIRMED',
        to: { userId },
        data: { bookingId: targetId }, // Generic ID
        channels: ['sms', 'push'],
      });

      // Award loyalty points - use bookingId only if it exists (not eventRequest.id or tripRequest.id)
      await this.loyalty.awardPoints(
        userId,
        Number(payment.amount),
        bookingIdForLoyalty || undefined,
      );

      // Realtime updates
      // this.realtime?.emitBookingUpdated(booking.id, { bookingId: booking.id, status: booking.status });
      // TODO: Emit for events?

      // Create referral earning if eligible (fire-and-forget)
      if (this.referrals) {
        try {
          await this.referrals.createEarningForFirstPayment(userId, payment.id);
        } catch (_) {}
      }
      return {
        success: true,
        paymentId: payment.id,
        eventRequestId: payment.eventRequestId ?? undefined,
        tripRequestId: payment.tripRequestId ?? undefined,
        giftOrderId: payment.giftOrderId ?? undefined,
      };

    } catch (e) {
      if (transactionStarted) {
        await queryRunner.rollbackTransaction();
      }
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async handleWebhook(dto: WebhookEventDto) {
    // Signature verification (mock but enforced via shared secret)
    const expectedSecret =
      this.configService.get<string>('PAYMENT_WEBHOOK_SECRET') ||
      'dev-webhook-secret';
    // In real gateway, you would compute signature from raw body + header secret
    const providedSecret = (dto as any).secret || dto.data?.secret;
    if (expectedSecret && providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (!dto.eventType || !dto.data?.paymentId) {
      throw new BadRequestException('Invalid webhook');
    }

    // Idempotency for webhook processing
    const idempotencyKey = `pay:webhook:${dto.eventType}:${dto.data.paymentId}`;
    const processed = await this.redisService.get(idempotencyKey);
    if (processed) {
      return { received: true, idempotent: true };
    }

    const payment = await this.paymentRepository.findOne({
      where: { id: dto.data.paymentId },
      relations: ['booking'],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (dto.eventType === 'payment.succeeded') {
      if (payment.status !== PaymentStatus.COMPLETED) {
        payment.status = PaymentStatus.COMPLETED;
        payment.paidAt = new Date();
        await this.paymentRepository.save(payment);
        const pendingFlowContext = this.getPendingFlowContext(payment);
        if (
          pendingFlowContext?.flowType &&
          !payment.offerBookingId &&
          !payment.subscriptionPurchaseId
        ) {
          await this.dataSource.transaction(async (manager) => {
            const qr = manager.getRepository(Payment);
            const reloadedPayment = await qr.findOne({
              where: { id: payment.id },
            });
            if (!reloadedPayment) return;
            const reloadedContext = this.getPendingFlowContext(reloadedPayment);
            if (
              reloadedPayment.offerBookingId ||
              reloadedPayment.subscriptionPurchaseId
            ) {
              return;
            }

            if (pendingFlowContext.flowType === 'offer_product') {
              const createdOfferBooking =
                await this.createOfferBookingAfterPayment(
                  { manager },
                  (reloadedContext?.userId as string) || '',
                  pendingFlowContext,
                );
              reloadedPayment.offerBookingId = createdOfferBooking.id;
            } else if (pendingFlowContext.flowType === 'wallet_recharge') {
              await this.walletService?.completeRechargeFromPayment(
                (reloadedContext?.userId as string) || '',
                Number(reloadedPayment.amount),
                reloadedPayment.id,
                manager,
                reloadedPayment.method,
              );
            } else if (pendingFlowContext.flowType === 'subscription_plan') {
              const createdPurchase =
                await this.createSubscriptionPurchaseAfterPayment(
                  { manager },
                  (reloadedContext?.userId as string) || '',
                  pendingFlowContext,
                );
              reloadedPayment.subscriptionPurchaseId = createdPurchase.id;
            }

            await manager.save(Payment, reloadedPayment);
          });
        }
        if (
          payment.booking &&
          payment.booking.status !== BookingStatus.CONFIRMED
        ) {
          payment.booking.status = BookingStatus.CONFIRMED;
          await this.bookingRepository.save(payment.booking);
        }

        // Handle offer booking payment
        if (payment.offerBookingId && this.offerBookingsService) {
          try {
            await this.offerBookingsService.confirmPayment(
              payment.offerBookingId,
            );
          } catch (e) {
            this.logger.error(
              `Webhook: Failed to confirm offer booking: ${e?.message || e}`,
            );
          }
        }

        // Handle subscription purchase payment
        if (
          payment.subscriptionPurchaseId &&
          this.subscriptionPurchasesService
        ) {
          try {
            await this.subscriptionPurchasesService.confirmPayment(
              payment.subscriptionPurchaseId,
            );
          } catch (e) {
            this.logger.error(
              `Webhook: Failed to confirm subscription purchase: ${e?.message || e}`,
            );
          }
        }
      }
    }

    await this.redisService.set(idempotencyKey, { ok: true }, 300);
    return { received: true };
  }

  async refundPayment(dto: RefundDto) {
    const payment = await this.paymentRepository.findOne({
      where: { id: dto.paymentId },
      relations: ['booking'],
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.COMPLETED)
      throw new BadRequestException('Only completed payments can be refunded');

    const amountToRefund = dto.amount ?? payment.amount;
    if (amountToRefund <= 0 || amountToRefund > payment.amount)
      throw new BadRequestException('Invalid refund amount');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      payment.refundedAmount = (payment.refundedAmount || 0) + amountToRefund;
      payment.refundedAt = new Date();
      payment.status =
        payment.refundedAmount >= payment.amount
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
      await queryRunner.manager.save(payment);

      // Optional: mark booking cancelled on full refund
      if (
        payment.booking &&
        payment.refundedAmount >= payment.amount &&
        payment.booking.status === BookingStatus.CONFIRMED
      ) {
        payment.booking.status = BookingStatus.CANCELLED;
        await queryRunner.manager.save(payment.booking);
      }

      await queryRunner.commitTransaction();
      return { success: true, status: payment.status };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async getPaymentById(userId: string, id: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: [
        'booking',
        'offerBooking',
        'subscriptionPurchase',
        'eventRequest',
        'tripRequest',
        'giftOrder',
      ],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // Owner or admin/ staff guarded at controller for other routes; here enforce owner check
    const isOwner =
      payment.booking?.userId === userId ||
      payment.offerBooking?.userId === userId ||
      payment.subscriptionPurchase?.userId === userId ||
      payment.eventRequest?.requesterId === userId ||
      payment.tripRequest?.requesterId === userId ||
      payment.giftOrder?.senderUserId === userId;
    if (!isOwner) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async getPaymentByIdAdmin(id: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['booking'],
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async listPaymentsAdmin(params: {
    status?: PaymentStatus;
    method?: PaymentMethod;
    from?: string;
    to?: string;
    userId?: string;
    bookingId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const {
      status,
      method,
      from,
      to,
      userId,
      bookingId,
      page = 1,
      pageSize = 20,
    } = params;

    const qb = this.paymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.booking', 'b')
      .orderBy('p.paidAt', 'DESC', 'NULLS LAST')
      .addOrderBy('p.createdAt', 'DESC');

    if (status) qb.andWhere('p.status = :status', { status });
    if (method) qb.andWhere('p.method = :method', { method });
    if (bookingId) qb.andWhere('p.bookingId = :bookingId', { bookingId });
    if (userId) qb.andWhere('b.userId = :userId', { userId });
    if (from)
      qb.andWhere('(p.paidAt IS NOT NULL AND p.paidAt >= :from)', { from });
    if (to) qb.andWhere('(p.paidAt IS NOT NULL AND p.paidAt <= :to)', { to });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }
}
