import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  GiftOrder,
  GiftType,
  GiftPaymentStatus,
  GiftStatus,
  FinalAssetType,
  WhatsAppStatus,
} from '../../database/entities/gift-order.entity';
import { GiftOrderEvent } from '../../database/entities/gift-order-event.entity';
import { OfferProduct } from '../../database/entities/offer-product.entity';
import { SubscriptionPlan } from '../../database/entities/subscription-plan.entity';
import { Branch } from '../../database/entities/branch.entity';
import { User, UserRole } from '../../database/entities/user.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { EncryptionService } from '../../utils/encryption.util';
import { normalizePhone, maskPhone, phonesMatch } from '../../utils/phone.util';
import { GiftQuoteDto } from './dto/gift-quote.dto';
import { CreateGiftOrderDto } from './dto/create-gift-order.dto';
import { ListGiftOrdersDto } from './dto/list-gift-orders.dto';
import { ClaimGiftDto } from './dto/claim-gift.dto';
import { CancelGiftDto } from './dto/cancel-gift.dto';
import { OfferBookingsService } from '../offer-bookings/offer-bookings.service';
import { SubscriptionPurchasesService } from '../subscription-purchases/subscription-purchases.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class GiftOrdersService {
  private readonly logger = new Logger(GiftOrdersService.name);

  constructor(
    @InjectRepository(GiftOrder)
    private readonly giftOrderRepo: Repository<GiftOrder>,
    @InjectRepository(GiftOrderEvent)
    private readonly giftOrderEventRepo: Repository<GiftOrderEvent>,
    @InjectRepository(OfferProduct)
    private readonly offerProductRepo: Repository<OfferProduct>,
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly offerBookingsService: OfferBookingsService,
    private readonly subscriptionPurchasesService: SubscriptionPurchasesService,
    private readonly notificationsService: NotificationsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async getQuote(userId: string, dto: GiftQuoteDto) {
    const normalizedRecipientPhone = normalizePhone(dto.recipientPhone);

    const sender = await this.userRepo.findOne({ where: { id: userId } });
    if (sender) {
      let senderPhone: string | undefined;
      try {
        senderPhone = sender.phone
          ? this.encryption.decrypt(sender.phone)
          : undefined;
      } catch {}
      if (senderPhone && phonesMatch(senderPhone, dto.recipientPhone)) {
        throw new BadRequestException({
          code: 'SELF_GIFT_NOT_ALLOWED',
          message: 'Cannot send a gift to yourself',
        });
      }
    }

    const branch = await this.branchRepo.findOne({
      where: { id: dto.branchId },
    });
    if (!branch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found',
      });
    }

    let productTitle = '';
    let subtotal = 0;
    let tax = 0;

    if (dto.giftType === GiftType.OFFER) {
      const product = await this.offerProductRepo.findOne({
        where: { id: dto.sourceProductId },
      });
      if (!product) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Offer product not found',
        });
      }
      if (!product.isGiftable) {
        throw new BadRequestException({
          code: 'PRODUCT_NOT_GIFTABLE',
          message: 'This product cannot be gifted',
        });
      }
      if (product.branchId !== dto.branchId) {
        throw new BadRequestException({
          code: 'PRODUCT_BRANCH_MISMATCH',
          message: 'Product does not belong to this branch',
        });
      }
      productTitle = product.title;
      subtotal = Number(product.price);
    } else {
      const plan = await this.subscriptionPlanRepo.findOne({
        where: { id: dto.sourceProductId },
      });
      if (!plan) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Subscription plan not found',
        });
      }
      if (!plan.isGiftable) {
        throw new BadRequestException({
          code: 'PRODUCT_NOT_GIFTABLE',
          message: 'This plan cannot be gifted',
        });
      }
      if (plan.branchId !== dto.branchId) {
        throw new BadRequestException({
          code: 'PRODUCT_BRANCH_MISMATCH',
          message: 'Plan does not belong to this branch',
        });
      }
      productTitle = plan.title;
      subtotal = Number(plan.price);
    }

    tax = subtotal * 0.15;
    const total = subtotal + tax;

    return {
      giftType: dto.giftType,
      subtotal,
      discount: 0,
      tax,
      total,
      currency: 'SAR',
      claimExpiryDays: Number(
        this.configService.get<string>('GIFT_CLAIM_EXPIRY_DAYS') || 30,
      ),
      productTitle,
      branchName: branch.name_ar,
      recipientPhoneValid: true,
      selfGift: false,
    };
  }

  async createGiftOrder(userId: string, dto: CreateGiftOrderDto) {
    const normalizedRecipientPhone = normalizePhone(dto.recipientPhone);

    const sender = await this.userRepo.findOne({ where: { id: userId } });
    if (sender) {
      let senderPhone: string | undefined;
      try {
        senderPhone = sender.phone
          ? this.encryption.decrypt(sender.phone)
          : undefined;
      } catch {}
      if (senderPhone && phonesMatch(senderPhone, dto.recipientPhone)) {
        throw new BadRequestException({
          code: 'SELF_GIFT_NOT_ALLOWED',
          message: 'Cannot send a gift to yourself',
        });
      }
    }

    const branch = await this.branchRepo.findOne({
      where: { id: dto.branchId },
    });
    if (!branch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found',
      });
    }

    let productTitle = '';
    let productSnapshot: Record<string, any> = {};
    let subtotal = 0;
    let tax = 0;

    if (dto.giftType === GiftType.OFFER) {
      const product = await this.offerProductRepo.findOne({
        where: { id: dto.sourceProductId },
      });
      if (!product) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Offer product not found',
        });
      }
      if (!product.isGiftable) {
        throw new BadRequestException({
          code: 'PRODUCT_NOT_GIFTABLE',
          message: 'This product cannot be gifted',
        });
      }
      productTitle = product.title;
      subtotal = Number(product.price);
      productSnapshot = {
        id: product.id,
        title: product.title,
        description: product.description,
        price: Number(product.price),
        currency: product.currency,
        offerCategory: product.offerCategory,
        ticketConfig: product.ticketConfig,
        hoursConfig: product.hoursConfig,
        includedAddOns: product.includedAddOns,
      };
    } else {
      const plan = await this.subscriptionPlanRepo.findOne({
        where: { id: dto.sourceProductId },
      });
      if (!plan) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Subscription plan not found',
        });
      }
      if (!plan.isGiftable) {
        throw new BadRequestException({
          code: 'PRODUCT_NOT_GIFTABLE',
          message: 'This plan cannot be gifted',
        });
      }
      productTitle = plan.title;
      subtotal = Number(plan.price);
      productSnapshot = {
        id: plan.id,
        title: plan.title,
        description: plan.description,
        price: Number(plan.price),
        currency: plan.currency,
        usageMode: plan.usageMode,
        totalHours: plan.totalHours,
        dailyHoursLimit: plan.dailyHoursLimit,
        durationType: plan.durationType,
        durationMonths: plan.durationMonths,
      };
    }

    tax = subtotal * 0.15;
    const total = subtotal + tax;

    let senderDisplayName: string | null = null;
    if (sender) {
      senderDisplayName = sender.name || null;
    }

    const giftOrder = new GiftOrder();
    giftOrder.giftType = dto.giftType;
    giftOrder.branchId = dto.branchId;
    giftOrder.senderUserId = userId;
    giftOrder.recipientPhone = dto.recipientPhone;
    giftOrder.normalizedRecipientPhone = normalizedRecipientPhone;
    giftOrder.showSenderInfo = dto.showSenderInfo ?? false;
    giftOrder.senderDisplayNameSnapshot = senderDisplayName ?? '';
    giftOrder.giftMessage = dto.giftMessage ?? '';
    giftOrder.sourceProductId = dto.sourceProductId;
    giftOrder.sourceProductSnapshot = productSnapshot;
    giftOrder.currency = 'SAR';
    giftOrder.subtotal = subtotal;
    giftOrder.discount = 0;
    giftOrder.tax = tax;
    giftOrder.total = total;
    giftOrder.paymentStatus = GiftPaymentStatus.PENDING;
    giftOrder.giftStatus = GiftStatus.PENDING_CLAIM;
    giftOrder.whatsappMessageStatus = WhatsAppStatus.PENDING;
    giftOrder.metadata = dto.addOns ? { addOns: dto.addOns } : {};

    const saved = await this.giftOrderRepo.save(giftOrder);

    await this.logEvent(saved.id, 'gift_created', 'sender', userId, {
      giftType: dto.giftType,
      recipientPhone: normalizedRecipientPhone,
      branchId: dto.branchId,
    });

    return {
      id: saved.id,
      giftType: saved.giftType,
      giftStatus: saved.giftStatus,
      paymentStatus: saved.paymentStatus,
      total: saved.total,
      currency: saved.currency,
      claimExpiresAt: saved.claimTokenExpiresAt,
    };
  }

  async logEvent(
    giftOrderId: string,
    eventType: string,
    actorType: string,
    actorId: string | null,
    payload: Record<string, any> | null,
  ): Promise<GiftOrderEvent> {
    const event = new GiftOrderEvent();
    event.giftOrderId = giftOrderId;
    event.eventType = eventType;
    event.actorType = actorType;
    event.actorId = actorId ?? '';
    event.payload = payload ?? {};
    return this.giftOrderEventRepo.save(event);
  }

  async getSentGifts(userId: string, query: ListGiftOrdersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.giftOrderRepo
      .createQueryBuilder('go')
      .leftJoinAndSelect('go.branch', 'branch')
      .where('go.senderUserId = :userId', { userId })
      .orderBy('go.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('go.giftStatus = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((go) => ({
        id: go.id,
        giftType: go.giftType,
        sourceProductTitle: go.sourceProductSnapshot?.title ?? '',
        branchName: (go as any).branch?.name_ar ?? '',
        recipientPhoneMasked: maskPhone(go.recipientPhone),
        total: go.total,
        currency: go.currency,
        paymentStatus: go.paymentStatus,
        giftStatus: go.giftStatus,
        whatsappMessageStatus: go.whatsappMessageStatus,
        claimExpiresAt: go.claimTokenExpiresAt,
        claimedAt: go.claimedAt,
        createdAt: go.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getReceivedGifts(userId: string, query: ListGiftOrdersDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.phone) {
      return {
        items: [],
        total: 0,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      };
    }

    let normalizedUserPhone: string;
    try {
      normalizedUserPhone = normalizePhone(this.encryption.decrypt(user.phone));
    } catch {
      return {
        items: [],
        total: 0,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.giftOrderRepo
      .createQueryBuilder('go')
      .leftJoinAndSelect('go.branch', 'branch')
      .where('go.normalizedRecipientPhone = :phone', {
        phone: normalizedUserPhone,
      })
      .orderBy('go.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('go.giftStatus = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((go) => ({
        id: go.id,
        giftType: go.giftType,
        sourceProductTitle: go.sourceProductSnapshot?.title ?? '',
        branchName: (go as any).branch?.name_ar ?? '',
        senderDisplayName: go.showSenderInfo
          ? go.senderDisplayNameSnapshot
          : null,
        giftMessage: go.giftMessage || null,
        total: go.total,
        currency: go.currency,
        giftStatus: go.giftStatus,
        claimExpiresAt: go.claimTokenExpiresAt,
        claimable:
          go.giftStatus === GiftStatus.PENDING_CLAIM &&
          go.paymentStatus === GiftPaymentStatus.PAID,
        claimedAt: go.claimedAt,
        finalAssetType: go.finalAssetType,
        finalAssetId: go.finalAssetId,
        createdAt: go.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getGiftDetails(userId: string, giftId: string) {
    const gift = await this.giftOrderRepo
      .createQueryBuilder('go')
      .leftJoinAndSelect('go.branch', 'branch')
      .where('go.id = :id', { id: giftId })
      .getOne();
    if (!gift) {
      throw new NotFoundException({
        code: 'GIFT_NOT_FOUND',
        message: 'Gift not found',
      });
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const isSender = gift.senderUserId === userId;
    let isRecipient = false;

    if (user?.phone) {
      try {
        const userPhone = normalizePhone(this.encryption.decrypt(user.phone));
        isRecipient = phonesMatch(userPhone, gift.normalizedRecipientPhone);
      } catch {}
    }

    if (!isSender && !isRecipient) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED',
        message: 'Not authorized to view this gift',
      });
    }

    const viewerRole = isSender ? 'sender' : 'recipient';
    const branchName = (gift as any).branch?.name_ar ?? '';

    return {
      id: gift.id,
      giftType: gift.giftType,
      branchName,
      sourceProductTitle: gift.sourceProductSnapshot?.title ?? '',
      sourceProductSnapshot: gift.sourceProductSnapshot,
      giftMessage: gift.giftMessage || null,
      total: gift.total,
      currency: gift.currency,
      paymentStatus: gift.paymentStatus,
      giftStatus: gift.giftStatus,
      claimExpiresAt: gift.claimTokenExpiresAt,
      whatsappMessageStatus: gift.whatsappMessageStatus,
      claimedAt: gift.claimedAt,
      finalAssetType: gift.finalAssetType,
      finalAssetId: gift.finalAssetId,
      createdAt: gift.createdAt,
      viewerRole,
      senderDisplayName:
        viewerRole === 'recipient' && gift.showSenderInfo
          ? gift.senderDisplayNameSnapshot
          : null,
      recipientPhoneMasked:
        viewerRole === 'sender' ? maskPhone(gift.recipientPhone) : null,
    };
  }

  async claimGift(userId: string, giftId: string, dto: ClaimGiftDto) {
    const gift = await this.giftOrderRepo.findOne({ where: { id: giftId } });
    if (!gift) {
      throw new NotFoundException({
        code: 'GIFT_NOT_FOUND',
        message: 'Gift not found',
      });
    }

    if (gift.giftStatus === GiftStatus.CLAIMED) {
      throw new BadRequestException({
        code: 'ALREADY_CLAIMED',
        message: 'Gift has already been claimed',
      });
    }
    if (gift.giftStatus !== GiftStatus.PENDING_CLAIM) {
      throw new BadRequestException({
        code: 'GIFT_NOT_CLAIMABLE',
        message: 'Gift is not in a claimable state',
      });
    }
    if (gift.paymentStatus !== GiftPaymentStatus.PAID) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_COMPLETED',
        message: 'Gift payment has not been completed',
      });
    }
    if (gift.claimTokenExpiresAt && new Date() > gift.claimTokenExpiresAt) {
      throw new BadRequestException({
        code: 'GIFT_EXPIRED',
        message: 'Gift claim window has expired',
      });
    }

    if (dto.claimToken && gift.claimTokenHash) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(dto.claimToken)
        .digest('hex');
      if (tokenHash !== gift.claimTokenHash) {
        throw new BadRequestException({
          code: 'INVALID_CLAIM_TOKEN',
          message: 'Invalid claim token',
        });
      }
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.phone) {
      throw new BadRequestException({
        code: 'PHONE_MISMATCH',
        message: 'User phone not available',
      });
    }

    let normalizedUserPhone: string;
    try {
      normalizedUserPhone = normalizePhone(this.encryption.decrypt(user.phone));
    } catch {
      throw new BadRequestException({
        code: 'PHONE_MISMATCH',
        message: 'Could not verify phone',
      });
    }

    if (!phonesMatch(normalizedUserPhone, gift.normalizedRecipientPhone)) {
      throw new BadRequestException({
        code: 'PHONE_MISMATCH',
        message: 'Your phone number does not match the gift recipient',
      });
    }

    let finalAssetType: FinalAssetType;
    let finalAssetId: string;

    if (gift.giftType === GiftType.OFFER) {
      const bookingResult = await this.offerBookingsService.createBooking(
        userId,
        {
          offerProductId: gift.sourceProductId,
          addOns: gift.metadata?.addOns,
          contactPhone: gift.recipientPhone,
          acceptedTerms: true,
        },
      );
      await this.offerBookingsService.confirmPayment(bookingResult.id);
      finalAssetType = FinalAssetType.OFFER_BOOKING;
      finalAssetId = bookingResult.id;
    } else {
      try {
        const purchaseResult =
          await this.subscriptionPurchasesService.createPurchase(userId, {
            subscriptionPlanId: gift.sourceProductId,
            acceptedTerms: true,
          });
        if (purchaseResult.paymentRequired) {
          await this.subscriptionPurchasesService.confirmPayment(
            purchaseResult.id,
          );
        }
        finalAssetType = FinalAssetType.SUBSCRIPTION_PURCHASE;
        finalAssetId = purchaseResult.id;
      } catch (error) {
        if (error instanceof ConflictException) {
          throw new BadRequestException({
            code: 'ACTIVE_SUBSCRIPTION_CONFLICT',
            message:
              'Recipient already has an active subscription in this branch',
          });
        }
        throw error;
      }
    }

    gift.giftStatus = GiftStatus.CLAIMED;
    gift.claimedByUserId = userId;
    gift.claimedAt = new Date();
    gift.finalAssetType = finalAssetType;
    gift.finalAssetId = finalAssetId;
    await this.giftOrderRepo.save(gift);

    await this.logEvent(gift.id, 'gift_claimed', 'recipient', userId, {
      claimedByUserId: userId,
      finalAssetType,
      finalAssetId,
    });

    await this.notificationsService
      .enqueue({
        type: 'GIFT_CLAIMED',
        to: { userId: gift.senderUserId },
        data: { productTitle: gift.sourceProductSnapshot?.title ?? '' },
        channels: ['push'],
        lang: 'ar',
      })
      .catch((err) =>
        this.logger.warn(`Failed to notify sender: ${err.message}`),
      );

    return {
      id: gift.id,
      giftStatus: gift.giftStatus,
      claimedAt: gift.claimedAt,
      finalAsset: {
        type: finalAssetType,
        id: finalAssetId,
        redirectPath:
          finalAssetType === FinalAssetType.OFFER_BOOKING
            ? `/offers/bookings/${finalAssetId}`
            : `/subscriptions/purchases/${finalAssetId}`,
      },
    };
  }

  async resolveClaimToken(userId: string, token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const gift = await this.giftOrderRepo
      .createQueryBuilder('go')
      .leftJoinAndSelect('go.branch', 'branch')
      .where('go.claimTokenHash = :hash', { hash: tokenHash })
      .getOne();

    if (!gift) {
      throw new NotFoundException({
        code: 'TOKEN_NOT_FOUND',
        message: 'No gift found with this token',
      });
    }

    if (gift.claimTokenExpiresAt && new Date() > gift.claimTokenExpiresAt) {
      throw new BadRequestException({
        code: 'TOKEN_EXPIRED',
        message: 'Claim token has expired',
      });
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user?.phone) {
      try {
        const userPhone = normalizePhone(this.encryption.decrypt(user.phone));
        if (!phonesMatch(userPhone, gift.normalizedRecipientPhone)) {
          throw new ForbiddenException({
            code: 'PHONE_MISMATCH',
            message: 'Your phone does not match the gift recipient',
          });
        }
      } catch (e) {
        if (e instanceof ForbiddenException) throw e;
      }
    }

    const branchName = (gift as any).branch?.name_ar ?? '';
    return {
      id: gift.id,
      giftType: gift.giftType,
      sourceProductTitle: gift.sourceProductSnapshot?.title ?? '',
      branchName,
      senderDisplayName: gift.showSenderInfo
        ? gift.senderDisplayNameSnapshot
        : null,
      giftMessage: gift.giftMessage || null,
      giftStatus: gift.giftStatus,
      claimExpiresAt: gift.claimTokenExpiresAt,
      claimable:
        gift.giftStatus === GiftStatus.PENDING_CLAIM &&
        gift.paymentStatus === GiftPaymentStatus.PAID,
    };
  }

  async resendInvite(userId: string, giftId: string) {
    const gift = await this.giftOrderRepo.findOne({ where: { id: giftId } });
    if (!gift) {
      throw new NotFoundException({
        code: 'GIFT_NOT_FOUND',
        message: 'Gift not found',
      });
    }

    if (gift.senderUserId !== userId) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED',
        message: 'You can only resend invites for your own gifts',
      });
    }

    if (gift.giftStatus === GiftStatus.CLAIMED) {
      throw new BadRequestException({
        code: 'GIFT_ALREADY_CLAIMED',
        message: 'This gift has already been claimed',
      });
    }

    if (gift.giftStatus === GiftStatus.CANCELLED) {
      throw new BadRequestException({
        code: 'GIFT_CANCELLED',
        message: 'This gift has been cancelled',
      });
    }

    if (gift.paymentStatus !== GiftPaymentStatus.PAID) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_COMPLETED',
        message: 'Payment has not been completed for this gift',
      });
    }

    gift.whatsappMessageStatus = WhatsAppStatus.PENDING;
    await this.giftOrderRepo.save(gift);

    await this.notificationsService
      .enqueue({
        type: 'GIFT_INVITE',
        to: { phone: gift.recipientPhone },
        data: {
          senderName: gift.senderDisplayNameSnapshot || 'مستخدم',
          productTitle: gift.sourceProductSnapshot?.title ?? '',
          branchName: gift.sourceProductSnapshot?.branchName ?? '',
          deepLinkUrl: `${this.configService.get<string>('APP_DEEP_LINK_BASE_URL') || 'loop://gift/claim'}?token=`,
        },
        channels: ['whatsapp'],
        lang: 'ar',
      })
      .catch((err) =>
        this.logger.warn(`Failed to resend WhatsApp invite: ${err.message}`),
      );

    await this.logEvent(gift.id, 'invite_resent', 'sender', userId, {
      recipientPhone: gift.normalizedRecipientPhone,
    });

    return {
      id: gift.id,
      whatsappMessageStatus: gift.whatsappMessageStatus,
    };
  }

  async cancelGift(userId: string, giftId: string, dto?: CancelGiftDto) {
    const gift = await this.giftOrderRepo.findOne({ where: { id: giftId } });
    if (!gift) {
      throw new NotFoundException({
        code: 'GIFT_NOT_FOUND',
        message: 'Gift not found',
      });
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const isSender = gift.senderUserId === userId;
    const isAdmin = user.roles?.includes(UserRole.ADMIN) ?? false;

    if (!isSender && !isAdmin) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED',
        message: 'You can only cancel your own gifts or need admin privileges',
      });
    }

    if (gift.giftStatus !== GiftStatus.PENDING_CLAIM) {
      throw new BadRequestException({
        code: 'GIFT_NOT_CANCELLABLE',
        message: 'Only pending gifts can be cancelled',
      });
    }

    if (gift.paymentStatus !== GiftPaymentStatus.PAID) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_COMPLETED',
        message: 'Only paid gifts can be cancelled',
      });
    }

    const payment = await this.paymentRepo.findOne({
      where: { giftOrderId: giftId, status: PaymentStatus.COMPLETED },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'No completed payment found for this gift',
      });
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      gift.giftStatus = GiftStatus.CANCELLED;
      await queryRunner.manager.save(gift);

      await this.paymentsService.refundPayment({
        paymentId: payment.id,
        reason: dto?.reason ?? 'Gift cancelled by sender',
      });

      await this.logEvent(
        gift.id,
        'gift_cancelled',
        isSender ? 'sender' : 'admin',
        userId,
        {
          reason: dto?.reason,
          refundInitiated: true,
        },
      );

      await queryRunner.commitTransaction();

      await this.notificationsService
        .enqueue({
          type: 'GIFT_EXPIRED',
          to: { userId: gift.senderUserId },
          data: {
            productTitle: gift.sourceProductSnapshot?.title ?? '',
            reason: 'تم إلغاء الهدية وإعادة المبلغ',
          },
          channels: ['push'],
          lang: 'ar',
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to notify sender about cancellation: ${err.message}`,
          ),
        );

      return {
        id: gift.id,
        giftStatus: gift.giftStatus,
        paymentStatus: GiftPaymentStatus.REFUNDED,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
