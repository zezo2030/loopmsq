import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import {
  SubscriptionPurchase,
  SubscriptionPurchasePaymentStatus,
  SubscriptionPurchaseStatus,
} from '../../database/entities/subscription-purchase.entity';
import { SubscriptionUsageLog } from '../../database/entities/subscription-usage-log.entity';
import {
  SubscriptionPlan,
  SubscriptionUsageMode,
} from '../../database/entities/subscription-plan.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { QRCodeService } from '../../utils/qr-code.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionQuoteDto } from './dto/subscription-quote.dto';
import {
  CreateSubscriptionPurchaseOptions,
  CreateSubscriptionPurchasePayload,
} from './dto/create-subscription-purchase.dto';
import { DeductHoursDto } from './dto/deduct-hours.dto';
import { User } from '../../database/entities/user.entity';
import { CloudinaryService } from '../../utils/cloudinary.service';

type PurchaseListFilters = {
  status?: SubscriptionPurchaseStatus;
  paymentStatus?: SubscriptionPurchasePaymentStatus;
  branchId?: string;
  from?: string;
  to?: string;
  search?: string;
};

@Injectable()
export class SubscriptionPurchasesService {
  private readonly logger = new Logger(SubscriptionPurchasesService.name);

  constructor(
    @InjectRepository(SubscriptionPurchase)
    private readonly purchaseRepo: Repository<SubscriptionPurchase>,
    @InjectRepository(SubscriptionUsageLog)
    private readonly usageLogRepo: Repository<SubscriptionUsageLog>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly qrCodeService: QRCodeService,
    private readonly notificationsService: NotificationsService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly dataSource: DataSource,
  ) {}

  async uploadHolderPhoto(file: Express.Multer.File) {
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Subscription holder photo must be an image');
    }

    const imageUrl = await this.cloudinaryService.uploadImage(
      file,
      'subscription-holders',
    );

    return { imageUrl };
  }

  /**
   * Same plan + branch with an unpaid checkout: reuse payment row instead of duplicating purchases.
   */
  private async findResumablePendingCheckout(
    userId: string,
    branchId: string,
    subscriptionPlanId: string,
    holderName: string,
    loyaltyStatus: { isEligibleForFreePurchase: boolean },
  ): Promise<{ purchase: SubscriptionPurchase; payment: Payment } | null> {
    if (loyaltyStatus.isEligibleForFreePurchase) {
      return null;
    }
    const legacy = await this.purchaseRepo.findOne({
      where: {
        userId,
        branchId,
        subscriptionPlanId,
        holderName,
        status: SubscriptionPurchaseStatus.ACTIVE,
        paymentStatus: SubscriptionPurchasePaymentStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
    const pending = await this.purchaseRepo.findOne({
      where: {
        userId,
        branchId,
        subscriptionPlanId,
        holderName,
        status: SubscriptionPurchaseStatus.PENDING_PAYMENT,
      },
      order: { createdAt: 'DESC' },
    });
    const purchase = pending ?? legacy;
    if (!purchase) {
      return null;
    }
    const payment = await this.paymentRepo.findOne({
      where: {
        subscriptionPurchaseId: purchase.id,
        status: PaymentStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
    if (!payment) {
      return null;
    }
    return { purchase, payment };
  }

  /**
   * Calculate pricing for a subscription purchase before payment.
   */
  async getQuote(userId: string, dto: SubscriptionQuoteDto) {
    const plan = await this.findActivePlan(dto.subscriptionPlanId);
    const loyaltyStatus = await this.getSixthPurchaseLoyaltyStatus(
      userId,
      plan.branchId,
      plan.id,
    );

    return {
      subscriptionPlanId: plan.id,
      planTitle: plan.title,
      totalPrice: loyaltyStatus.isEligibleForFreePurchase
        ? 0
        : Number(plan.price),
      currency: plan.currency || 'SAR',
      usageMode: plan.usageMode,
      totalHours: plan.totalHours != null ? Number(plan.totalHours) : null,
      dailyHoursLimit:
        plan.dailyHoursLimit != null ? Number(plan.dailyHoursLimit) : null,
      durationMonths: plan.durationMonths,
      mealItems: plan.mealItems || [],
      termsAndConditions: plan.termsAndConditions || null,
      loyalty: loyaltyStatus,
    };
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

  private isValidUsageMode(value: unknown): value is SubscriptionUsageMode {
    return (
      value === SubscriptionUsageMode.FLEXIBLE_TOTAL_HOURS ||
      value === SubscriptionUsageMode.DAILY_LIMITED ||
      value === SubscriptionUsageMode.DAILY_UNLIMITED
    );
  }

  /**
   * Resolve purchase usage mode defensively so legacy snapshots do not regress
   * unlimited daily subscriptions into limited/hour-based behavior.
   */
  private resolvePurchaseUsageMode(
    purchase: SubscriptionPurchase,
  ): SubscriptionUsageMode {
    const hasUnlimitedShape =
      purchase.totalHours == null &&
      purchase.dailyHoursLimit == null &&
      purchase.remainingHours == null;

    if (hasUnlimitedShape) {
      return SubscriptionUsageMode.DAILY_UNLIMITED;
    }

    const snapshotMode = purchase.planSnapshot?.usageMode;
    if (this.isValidUsageMode(snapshotMode)) {
      return snapshotMode;
    }

    const planMode = purchase.subscriptionPlan?.usageMode;
    if (this.isValidUsageMode(planMode)) {
      return planMode;
    }

    const hasTotalHours = purchase.totalHours != null;
    const hasDailyLimit = purchase.dailyHoursLimit != null;

    if (hasDailyLimit) {
      return SubscriptionUsageMode.DAILY_LIMITED;
    }

    return SubscriptionUsageMode.FLEXIBLE_TOTAL_HOURS;
  }

  private isDailyCrossBranchPurchase(purchase: SubscriptionPurchase): boolean {
    const usageMode = this.resolvePurchaseUsageMode(purchase);
    if (
      usageMode === SubscriptionUsageMode.DAILY_UNLIMITED ||
      usageMode === SubscriptionUsageMode.DAILY_LIMITED ||
      usageMode === SubscriptionUsageMode.FLEXIBLE_TOTAL_HOURS
    ) {
      return true;
    }

    // Legacy snapshots may still contain older naming.
    const legacySnapshotMode = purchase.planSnapshot?.usageMode
      ?.toString()
      .toLowerCase()
      .trim();
    if (
      legacySnapshotMode === 'daily_limited' ||
      legacySnapshotMode === 'daily_unlimited' ||
      legacySnapshotMode === 'monthly_pool' ||
      legacySnapshotMode === 'unlimited'
    ) {
      return true;
    }

    // Fallback heuristic: any explicit daily cap implies a daily plan.
    const snapshotDailyCap = Number(purchase.planSnapshot?.dailyHoursLimit);
    if (
      purchase.dailyHoursLimit != null ||
      (Number.isFinite(snapshotDailyCap) && snapshotDailyCap > 0)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Create a subscription purchase and initiate payment.
   */
  async createPurchase(
    userId: string,
    dto: CreateSubscriptionPurchasePayload,
    options?: CreateSubscriptionPurchaseOptions,
  ) {
    const allowMissingHolderImage = options?.allowMissingHolderImage === true;
    const plan = await this.findActivePlan(dto.subscriptionPlanId);
    if (!dto.acceptedTerms) {
      throw new BadRequestException(
        'Subscription terms and conditions must be accepted',
      );
    }
    if (!allowMissingHolderImage && !dto.holderImageUrl?.trim()) {
      throw new BadRequestException('Subscription holder photo is required');
    }

    const trimmedHolder = dto.holderImageUrl?.trim();
    const trimmedHolderName = dto.holderName?.trim();
    if (!trimmedHolderName && !allowMissingHolderImage) {
      throw new BadRequestException('Subscription holder name is required');
    }
    const holderName = trimmedHolderName || 'Gift recipient';

    const loyaltyStatus = await this.getSixthPurchaseLoyaltyStatus(
      userId,
      plan.branchId,
      plan.id,
    );
    const totalPrice = loyaltyStatus.isEligibleForFreePurchase
      ? 0
      : Number(plan.price);

    const resumable = await this.findResumablePendingCheckout(
      userId,
      plan.branchId,
      plan.id,
      holderName,
      loyaltyStatus,
    );
    if (resumable) {
      const { purchase: rp, payment: pay } = resumable;
      if (rp.holderName !== holderName) {
        rp.holderName = holderName;
        await this.purchaseRepo.save(rp);
      }
      if (!allowMissingHolderImage) {
        const nextHolderImageUrl = trimmedHolder!;
        if (rp.holderImageUrl !== nextHolderImageUrl) {
          rp.holderImageUrl = nextHolderImageUrl;
          await this.purchaseRepo.save(rp);
        }
      } else if (trimmedHolder) {
        if (rp.holderImageUrl !== trimmedHolder) {
          rp.holderImageUrl = trimmedHolder;
          await this.purchaseRepo.save(rp);
        }
      }
      this.logger.log(
        `Resuming pending subscription checkout ${rp.id} for user ${userId}`,
      );
      return {
        id: rp.id,
        paymentId: pay.id,
        paymentUrl: `/pay/${pay.id}`,
        totalPrice,
        currency: plan.currency || 'SAR',
        paymentRequired: totalPrice > 0,
        isFreePurchase: totalPrice === 0,
        loyalty: loyaltyStatus,
      };
    }

    const totalHours = plan.totalHours != null ? Number(plan.totalHours) : null;
    const dailyHoursLimit =
      plan.dailyHoursLimit != null ? Number(plan.dailyHoursLimit) : null;
    const provisionalStartedAt = new Date();
    const provisionalEndsAt = this.addCalendarMonths(
      provisionalStartedAt,
      plan.durationMonths,
    );
    const provisionalQrToken = this.qrCodeService.generateSubscriptionToken(
      `pending-${userId}-${Date.now()}`,
    );
    const provisionalQrTokenHash =
      this.qrCodeService.hashToken(provisionalQrToken);

    // Create plan snapshot
    const planSnapshot = {
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
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create purchase
      const purchase = queryRunner.manager.create(SubscriptionPurchase, {
        userId,
        branchId: plan.branchId,
        subscriptionPlanId: plan.id,
        planSnapshot,
        totalHours,
        remainingHours:
          plan.usageMode === SubscriptionUsageMode.DAILY_UNLIMITED
            ? null
            : totalHours,
        dailyHoursLimit,
        startedAt: provisionalStartedAt,
        endsAt: provisionalEndsAt,
        qrTokenHash: provisionalQrTokenHash,
        holderName,
        holderImageUrl: allowMissingHolderImage
          ? trimmedHolder || null
          : trimmedHolder!,
        paymentStatus: 'pending' as any,
        status:
          totalPrice > 0
            ? SubscriptionPurchaseStatus.PENDING_PAYMENT
            : SubscriptionPurchaseStatus.ACTIVE,
        metadata: {
          acceptedTerms: true,
          acceptedTermsAt: new Date().toISOString(),
          termsAndConditions: plan.termsAndConditions || null,
          loyaltyRewardApplied: loyaltyStatus.isEligibleForFreePurchase,
        },
      });

      const savedPurchase = await queryRunner.manager.save(
        SubscriptionPurchase,
        purchase,
      );

      // Create payment record
      const payment = queryRunner.manager.create(Payment, {
        subscriptionPurchaseId: savedPurchase.id,
        amount: totalPrice,
        currency: plan.currency || 'SAR',
        status: PaymentStatus.PENDING,
        method: 'credit_card' as any,
      });

      const savedPayment = await queryRunner.manager.save(Payment, payment);

      await queryRunner.commitTransaction();

      if (totalPrice === 0) {
        savedPayment.status = PaymentStatus.COMPLETED;
        savedPayment.paidAt = new Date();
        await this.paymentRepo.save(savedPayment);
        await this.confirmPayment(savedPurchase.id);
      }

      this.logger.log(
        `Subscription purchase created: ${savedPurchase.id} for user ${userId}, payment: ${savedPayment.id}`,
      );

      return {
        id: savedPurchase.id,
        paymentId: savedPayment.id,
        paymentUrl: `/pay/${savedPayment.id}`,
        totalPrice,
        currency: plan.currency || 'SAR',
        paymentRequired: totalPrice > 0,
        isFreePurchase: totalPrice === 0,
        loyalty: loyaltyStatus,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create subscription purchase: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Called by PaymentsService after payment is confirmed.
   * Idempotent: safe to call multiple times - skips if subscription already activated.
   */
  async confirmPayment(purchaseId: string) {
    const purchase = await this.purchaseRepo.findOne({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException('Subscription purchase not found');
    }

    const existingRawToken = purchase.metadata?.qrData;

    if (
      purchase.paymentStatus === 'completed' &&
      purchase.qrTokenHash &&
      existingRawToken
    ) {
      this.logger.warn(`Purchase ${purchaseId} already confirmed`);
      return;
    }

    const plan = await this.planRepo.findOne({
      where: { id: purchase.subscriptionPlanId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (purchase.qrTokenHash && existingRawToken) {
      this.logger.log(
        `Purchase ${purchaseId} already has QR token - ensuring consistency`,
      );
      purchase.paymentStatus = 'completed' as any;
      purchase.status = SubscriptionPurchaseStatus.ACTIVE;
      await this.purchaseRepo.save(purchase);
      return;
    }

    const now = new Date();
    const startedAt = now;
    const endsAt = this.addCalendarMonths(now, plan.durationMonths);

    const rawToken = this.qrCodeService.generateSubscriptionToken(purchase.id);
    const qrTokenHash = this.qrCodeService.hashToken(rawToken);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      purchase.paymentStatus = 'completed' as any;
      purchase.status = SubscriptionPurchaseStatus.ACTIVE;
      purchase.startedAt = startedAt;
      purchase.endsAt = endsAt;
      purchase.qrTokenHash = qrTokenHash;

      await queryRunner.manager.save(SubscriptionPurchase, purchase);

      purchase.metadata = {
        ...(purchase.metadata || {}),
        qrData: rawToken,
      };
      await queryRunner.manager.save(SubscriptionPurchase, purchase);

      await queryRunner.commitTransaction();

      this.logger.log(`Subscription purchase ${purchaseId} confirmed`);

      await this.notificationsService.enqueue({
        type: 'SUBSCRIPTION_PURCHASE_SUCCESS',
        to: { userId: purchase.userId },
        data: {
          purchaseId,
          planTitle: plan.title,
          totalHours:
            plan.totalHours != null ? Number(plan.totalHours) : 'Unlimited',
        },
        channels: ['push'],
        lang: 'ar',
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to confirm subscription purchase: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get paginated user subscriptions.
   */
  async findUserPurchases(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: SubscriptionPurchaseStatus,
  ) {
    const qb = this.purchaseRepo
      .createQueryBuilder('purchase')
      .where('purchase.userId = :userId', { userId });

    if (status) {
      qb.andWhere('purchase.status = :status', { status });
    } else {
      qb.andWhere('purchase.status != :excludePendingPayment', {
        excludePendingPayment: SubscriptionPurchaseStatus.PENDING_PAYMENT,
      });
    }

    qb.orderBy('purchase.createdAt', 'DESC');

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    for (const item of items) {
      await this.checkAndUpdateExpired(item);
    }

    return {
      subscriptions: items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAdminPurchases(
    page: number = 1,
    limit: number = 20,
    filters: PurchaseListFilters = {},
  ) {
    return this.findPurchasesList(page, limit, filters);
  }

  async findBranchPurchases(
    branchId: string,
    page: number = 1,
    limit: number = 20,
    filters: Omit<PurchaseListFilters, 'branchId'> = {},
  ) {
    return this.findPurchasesList(page, limit, { ...filters, branchId });
  }

  /**
   * Get subscription purchase details (owner only).
   */
  async findPurchaseById(purchaseId: string, userId: string) {
    const purchase = await this.purchaseRepo.findOne({
      where: { id: purchaseId, userId },
    });

    if (!purchase) {
      throw new NotFoundException('Subscription purchase not found');
    }

    // Lazy expiration check
    await this.checkAndUpdateExpired(purchase);

    // Get raw token from metadata
    const rawToken = purchase.metadata?.qrData || '';
    const qrData = rawToken
      ? this.qrCodeService.generateSubscriptionToken(purchase.id)
      : '';

    return {
      ...purchase,
      qrData: rawToken || qrData,
    };
  }

  async findPurchaseForAdmin(purchaseId: string) {
    return this.findPurchaseDetail(purchaseId);
  }

  async findPurchaseForBranch(purchaseId: string, branchId: string) {
    return this.findPurchaseDetail(purchaseId, branchId);
  }

  private async assertStaffSubscriptionBranch(
    staffId: string,
    purchase: SubscriptionPurchase,
  ): Promise<void> {
    const staff = await this.userRepo.findOne({ where: { id: staffId } });

    // Daily-based subscriptions are valid cross-branch by business rule.
    // Only pooled total-hours subscriptions remain branch-restricted.
    if (this.isDailyCrossBranchPurchase(purchase)) {
      return;
    }

    if (!staff?.branchId || staff.branchId !== purchase.branchId) {
      const b = purchase.branch;
      const ticketBranchName = b?.name_ar || b?.name_en || '';
      this.logger.warn(
        `Subscription BRANCH_MISMATCH: staffId=${staffId}, staffBranch=${staff?.branchId || 'none'}, purchaseId=${purchase.id}, purchaseBranch=${purchase.branchId}, resolvedUsageMode=${this.resolvePurchaseUsageMode(purchase)}, snapshotUsageMode=${purchase.planSnapshot?.usageMode ?? 'none'}`,
      );
      throw new HttpException(
        {
          errorCode: 'BRANCH_MISMATCH',
          ticketBranchName,
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /**
   * Find subscription by QR token hash (for staff scan).
   */
  async findByToken(token: string, staffId: string) {
    const trimmed = token.trim();
    const normalized = trimmed.startsWith('SP:') ? trimmed : `SP:${trimmed}`;
    const qrTokenHash = this.qrCodeService.hashToken(normalized);

    const purchase = await this.purchaseRepo.findOne({
      where: { qrTokenHash },
      relations: ['subscriptionPlan', 'user', 'branch'],
    });

    if (!purchase) {
      throw new NotFoundException('Subscription not found');
    }

    await this.assertStaffSubscriptionBranch(staffId, purchase);

    if (
      purchase.paymentStatus !== SubscriptionPurchasePaymentStatus.COMPLETED
    ) {
      throw new BadRequestException('Subscription payment is not completed');
    }

    // Lazy expiration check
    await this.checkAndUpdateExpired(purchase);

    // Calculate daily usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyUsedResult = await this.usageLogRepo
      .createQueryBuilder('log')
      .select('SUM(log.deductedHours)', 'sum')
      .where('log.subscriptionPurchaseId = :purchaseId', {
        purchaseId: purchase.id,
      })
      .andWhere('log.createdAt >= :today', { today })
      .getRawOne();

    const dailyUsedToday = Number(dailyUsedResult?.sum || 0);
    const usageMode = this.resolvePurchaseUsageMode(purchase);
    const dailyRemainingToday =
      usageMode !== SubscriptionUsageMode.DAILY_UNLIMITED &&
        purchase.dailyHoursLimit != null
        ? Number(purchase.dailyHoursLimit) - dailyUsedToday
        : null;

    return {
      holderName: purchase.holderName,
      customerName: purchase.holderName || purchase.user?.name || 'User',
      holderImageUrl: purchase.holderImageUrl,
      subscription: {
        id: purchase.id,
        holderName: purchase.holderName,
        customerName: purchase.holderName || purchase.user?.name || 'User',
        status: purchase.status,
        totalHours: purchase.totalHours,
        remainingHours: purchase.remainingHours,
        dailyHoursLimit: purchase.dailyHoursLimit,
        dailyUsedToday,
        dailyRemainingToday,
        usageMode,
        canDeductHours: true,
        startedAt: purchase.startedAt,
        endsAt: purchase.endsAt,
      },
      plan: {
        title: purchase.subscriptionPlan?.title,
        imageUrl: purchase.subscriptionPlan?.imageUrl,
        mealItems:
          purchase.planSnapshot?.mealItems ||
          purchase.subscriptionPlan?.mealItems ||
          [],
      },
      user: {
        id: purchase.userId,
        name: purchase.holderName || purchase.user?.name || 'User',
        phone: purchase.user?.phone || '',
        imageUrl: purchase.holderImageUrl,
      },
      branch: {
        id: purchase.branchId,
        name: purchase.branch?.name_ar || purchase.branch?.name_en || 'Branch',
      },
    };
  }

  /**
   * Deduct hours from a subscription (staff action).
   */
  async deductHours(dto: DeductHoursDto, staffId: string) {
    const purchase = await this.purchaseRepo.findOne({
      where: { id: dto.subscriptionPurchaseId },
      relations: ['branch', 'subscriptionPlan'],
    });

    if (!purchase) {
      throw new NotFoundException('Subscription not found');
    }

    await this.assertStaffSubscriptionBranch(staffId, purchase);

    if (
      purchase.paymentStatus !== SubscriptionPurchasePaymentStatus.COMPLETED
    ) {
      throw new BadRequestException('Subscription payment is not completed');
    }

    // Check status
    if (purchase.status !== SubscriptionPurchaseStatus.ACTIVE) {
      throw new BadRequestException(
        `Subscription is ${purchase.status}, cannot deduct hours`,
      );
    }

    // Check expiration
    if (purchase.endsAt && new Date() > purchase.endsAt) {
      throw new BadRequestException('Subscription has expired');
    }

    // Validate hours
    const hours = Number(dto.hours);
    if (hours <= 0 || hours % 0.5 !== 0) {
      throw new BadRequestException('Hours must be a positive multiple of 0.5');
    }

    const usageMode = this.resolvePurchaseUsageMode(purchase);

    if (
      usageMode !== SubscriptionUsageMode.DAILY_UNLIMITED &&
      hours > Number(purchase.remainingHours || 0)
    ) {
      throw new BadRequestException('Hours exceed remaining hours');
    }

    // Calculate daily usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyUsedResult = await this.usageLogRepo
      .createQueryBuilder('log')
      .select('SUM(log.deductedHours)', 'sum')
      .where('log.subscriptionPurchaseId = :purchaseId', {
        purchaseId: purchase.id,
      })
      .andWhere('log.createdAt >= :today', { today })
      .getRawOne();

    const dailyUsedToday = Number(dailyUsedResult?.sum || 0);
    const dailyRemainingToday =
      purchase.dailyHoursLimit != null
        ? Number(purchase.dailyHoursLimit) - dailyUsedToday
        : null;

    if (dailyRemainingToday != null && hours > dailyRemainingToday) {
      throw new BadRequestException(
        `Hours exceed daily limit. Remaining today: ${dailyRemainingToday}`,
      );
    }

    const remainingHoursBefore = Number(purchase.remainingHours || 0);
    const remainingHoursAfter =
      usageMode === SubscriptionUsageMode.DAILY_UNLIMITED
        ? remainingHoursBefore
        : remainingHoursBefore - hours;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update purchase only for finite-hour subscriptions.
      if (usageMode !== SubscriptionUsageMode.DAILY_UNLIMITED) {
        purchase.remainingHours = remainingHoursAfter;

        if (remainingHoursAfter <= 0) {
          purchase.status = SubscriptionPurchaseStatus.DEPLETED;
          purchase.remainingHours = 0;
        }

        await queryRunner.manager.save(SubscriptionPurchase, purchase);
      }

      // Create usage log
      const usageLog = queryRunner.manager.create(SubscriptionUsageLog, {
        subscriptionPurchaseId: purchase.id,
        staffId,
        branchId: purchase.branchId,
        deductedHours: hours,
        remainingHoursBefore,
        remainingHoursAfter,
        dailyUsedBefore: dailyUsedToday,
        dailyUsedAfter: dailyUsedToday + hours,
        notes: dto.notes || undefined,
      });

      const savedLog = await queryRunner.manager.save(
        SubscriptionUsageLog,
        usageLog,
      );

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Hours set successfully',
        subscription: {
          remainingHours:
            usageMode === SubscriptionUsageMode.DAILY_UNLIMITED
              ? purchase.remainingHours
              : remainingHoursAfter,
          dailyUsedToday: dailyUsedToday + hours,
          dailyRemainingToday:
            dailyRemainingToday != null ? dailyRemainingToday - hours : null,
          status: purchase.status,
        },
        usageLog: {
          id: savedLog.id,
          deductedHours: hours,
          remainingHoursBefore,
          remainingHoursAfter,
          createdAt: savedLog.createdAt,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to deduct hours: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Usage logs for staff: purchase must belong to the staff member's branch.
   */
  async findUsageLogsForStaff(
    purchaseId: string,
    staffId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const purchase = await this.purchaseRepo.findOne({
      where: { id: purchaseId },
      relations: ['branch', 'subscriptionPlan'],
    });
    if (!purchase) {
      throw new NotFoundException('Subscription not found');
    }
    await this.assertStaffSubscriptionBranch(staffId, purchase);
    return this.findUsageLogs(purchaseId, page, limit);
  }

  async findUsageLogsByStaff(
    staffId: string,
    page: number = 1,
    limit: number = 50,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;

    const qb = this.usageLogRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.subscriptionPurchase', 'purchase')
      .leftJoinAndSelect('purchase.user', 'user')
      .leftJoinAndSelect('purchase.branch', 'purchaseBranch')
      .leftJoinAndSelect('log.branch', 'logBranch')
      .where('log.staffId = :staffId', { staffId })
      .orderBy('log.createdAt', 'DESC')
      .skip((Math.max(page, 1) - 1) * Math.max(limit, 1))
      .take(Math.max(limit, 1));

    if (from && !Number.isNaN(from.getTime())) {
      qb.andWhere('log.createdAt >= :from', { from });
    }
    if (to && !Number.isNaN(to.getTime())) {
      qb.andWhere('log.createdAt <= :to', { to });
    }

    const [logs, total] = await qb.getManyAndCount();

    return {
      logs: logs.map((log) => ({
        id: log.id,
        subscriptionPurchaseId: log.subscriptionPurchaseId,
        deductedHours: Number(log.deductedHours),
        notes: log.notes,
        createdAt: log.createdAt,
        customerName:
          log.subscriptionPurchase?.holderName ||
          log.subscriptionPurchase?.user?.name ||
          'Unknown',
        branchName:
          log.branch?.name_ar ||
          log.branch?.name_en ||
          log.subscriptionPurchase?.branch?.name_ar ||
          log.subscriptionPurchase?.branch?.name_en ||
          'Unknown Branch',
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Get usage logs for a subscription.
   */
  async findUsageLogs(
    purchaseId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const [logs, total] = await this.usageLogRepo.findAndCount({
      where: { subscriptionPurchaseId: purchaseId },
      relations: ['staff'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      logs: logs.map((log) => ({
        id: log.id,
        staffId: log.staffId,
        staffName: log.staff?.name || 'Staff',
        deductedHours: log.deductedHours,
        remainingHoursBefore: log.remainingHoursBefore,
        remainingHoursAfter: log.remainingHoursAfter,
        dailyUsedBefore: log.dailyUsedBefore,
        dailyUsedAfter: log.dailyUsedAfter,
        notes: log.notes,
        createdAt: log.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async findUsageLogsForOwner(
    purchaseId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const purchase = await this.purchaseRepo.findOne({
      where: { id: purchaseId, userId },
    });

    if (!purchase) {
      throw new NotFoundException('Subscription purchase not found');
    }

    return this.findUsageLogs(purchaseId, page, limit);
  }

  /**
   * Find active plan with validation.
   */
  private async findActivePlan(planId: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepo.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (!plan.isActive) {
      throw new BadRequestException('Subscription plan is not active');
    }

    const now = new Date();
    if (plan.startsAt && now < plan.startsAt) {
      throw new BadRequestException('Plan has not started yet');
    }
    if (plan.endsAt && now > plan.endsAt) {
      throw new BadRequestException('Plan has expired');
    }

    if (!plan.usageMode) {
      plan.usageMode = SubscriptionUsageMode.DAILY_LIMITED;
    }

    return plan;
  }

  private async findPurchasesList(
    page: number,
    limit: number,
    filters: PurchaseListFilters,
  ) {
    const qb = this.purchaseRepo
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.user', 'user')
      .leftJoinAndSelect('purchase.branch', 'branch')
      .leftJoinAndSelect('purchase.subscriptionPlan', 'subscriptionPlan');

    if (filters.branchId) {
      qb.andWhere('purchase.branchId = :branchId', {
        branchId: filters.branchId,
      });
    }

    if (filters.status) {
      qb.andWhere('purchase.status = :status', { status: filters.status });
    }

    if (filters.paymentStatus) {
      qb.andWhere('purchase.paymentStatus = :paymentStatus', {
        paymentStatus: filters.paymentStatus,
      });
    }

    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) {
        from.setHours(0, 0, 0, 0);
        qb.andWhere('purchase.createdAt >= :from', { from });
      }
    }

    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        qb.andWhere('purchase.createdAt <= :to', { to });
      }
    }

    if (filters.search?.trim()) {
      const search = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(
          LOWER(COALESCE(user.name, '')) LIKE :search OR
          LOWER(COALESCE(purchase."holderName", '')) LIKE :search OR
          LOWER(COALESCE(user.phone, '')) LIKE :search OR
          LOWER(COALESCE(branch.name_ar, branch.name_en, '')) LIKE :search OR
          LOWER(COALESCE(subscriptionPlan.title, purchase.planSnapshot->>'title', '')) LIKE :search OR
          LOWER(COALESCE(purchase.id::text, '')) LIKE :search
        )`,
        { search },
      );
    }

    qb.orderBy('purchase.createdAt', 'DESC');

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsQb = this.purchaseRepo
      .createQueryBuilder('purchase')
      .select('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN purchase.status = :activeStatus AND purchase.paymentStatus = :completedPaymentStatusForActive THEN 1 ELSE 0 END)`,
        'active',
      )
      .addSelect(
        `SUM(CASE WHEN purchase.status = :expiredStatus THEN 1 ELSE 0 END)`,
        'expired',
      )
      .addSelect(
        `SUM(CASE WHEN purchase.status = :depletedStatus THEN 1 ELSE 0 END)`,
        'depleted',
      )
      .addSelect(
        `SUM(CASE WHEN purchase.paymentStatus = :completedPaymentStatus THEN 1 ELSE 0 END)`,
        'paid',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN purchase.paymentStatus = :completedPaymentStatus THEN (purchase.planSnapshot->>'price')::numeric ELSE 0 END), 0)`,
        'revenue',
      )
      .setParameters({
        activeStatus: SubscriptionPurchaseStatus.ACTIVE,
        completedPaymentStatusForActive:
          SubscriptionPurchasePaymentStatus.COMPLETED,
        expiredStatus: SubscriptionPurchaseStatus.EXPIRED,
        depletedStatus: SubscriptionPurchaseStatus.DEPLETED,
        completedPaymentStatus: SubscriptionPurchasePaymentStatus.COMPLETED,
      });

    if (filters.branchId) {
      statsQb.andWhere('purchase.branchId = :branchId', {
        branchId: filters.branchId,
      });
    }
    if (filters.status) {
      statsQb.andWhere('purchase.status = :status', { status: filters.status });
    }
    if (filters.paymentStatus) {
      statsQb.andWhere('purchase.paymentStatus = :paymentStatus', {
        paymentStatus: filters.paymentStatus,
      });
    }
    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) {
        from.setHours(0, 0, 0, 0);
        statsQb.andWhere('purchase.createdAt >= :from', { from });
      }
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        statsQb.andWhere('purchase.createdAt <= :to', { to });
      }
    }

    let rawStats: {
      total: string;
      active: string;
      expired: string;
      depleted: string;
      paid: string;
      revenue: string;
    } | null = null;
    try {
      rawStats = (await statsQb.getRawOne()) ?? null;
    } catch (e) {
      this.logger.error(
        `findPurchasesList stats query failed: ${(e as Error)?.message}`,
        (e as Error)?.stack,
      );
    }

    const rawStatsResolved = rawStats ?? {
      total: '0',
      active: '0',
      expired: '0',
      depleted: '0',
      paid: '0',
      revenue: '0',
    };

    return {
      subscriptions: items.map((purchase) => ({
        id: purchase.id,
        status: purchase.status,
        paymentStatus: purchase.paymentStatus,
        holderName: purchase.holderName,
        holderImageUrl: purchase.holderImageUrl,
        totalHours:
          purchase.totalHours != null ? Number(purchase.totalHours) : null,
        remainingHours:
          purchase.remainingHours != null
            ? Number(purchase.remainingHours)
            : null,
        dailyHoursLimit:
          purchase.dailyHoursLimit != null
            ? Number(purchase.dailyHoursLimit)
            : null,
        startedAt: purchase.startedAt,
        endsAt: purchase.endsAt,
        createdAt: purchase.createdAt,
        updatedAt: purchase.updatedAt,
        user: {
          id: purchase.userId,
          name: purchase.holderName || purchase.user?.name || 'User',
          phone: purchase.user?.phone || '',
          email: purchase.user?.email || '',
          imageUrl: purchase.holderImageUrl,
        },
        branch: {
          id: purchase.branchId,
          name:
            purchase.branch?.name_ar || purchase.branch?.name_en || 'Branch',
        },
        plan: {
          id: purchase.subscriptionPlanId,
          title:
            purchase.subscriptionPlan?.title ||
            purchase.planSnapshot?.title ||
            'Subscription',
          usageMode: this.resolvePurchaseUsageMode(purchase),
          durationMonths:
            purchase.subscriptionPlan?.durationMonths ||
            purchase.planSnapshot?.durationMonths ||
            null,
          price:
            purchase.subscriptionPlan?.price != null
              ? Number(purchase.subscriptionPlan.price)
              : Number(purchase.planSnapshot?.price || 0),
          currency:
            purchase.subscriptionPlan?.currency ||
            purchase.planSnapshot?.currency ||
            'SAR',
          imageUrl:
            purchase.subscriptionPlan?.imageUrl ||
            purchase.planSnapshot?.imageUrl ||
            null,
        },
      })),
      stats: {
        total: Number(rawStatsResolved?.total || 0),
        active: Number(rawStatsResolved?.active || 0),
        expired: Number(rawStatsResolved?.expired || 0),
        depleted: Number(rawStatsResolved?.depleted || 0),
        paid: Number(rawStatsResolved?.paid || 0),
        revenue: Number(rawStatsResolved?.revenue || 0),
      },
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async findPurchaseDetail(purchaseId: string, branchId?: string) {
    const whereClause: Record<string, any> = { id: purchaseId };
    if (branchId) whereClause.branchId = branchId;

    const purchase = await this.purchaseRepo.findOne({
      where: whereClause,
      relations: ['user', 'branch', 'subscriptionPlan'],
    });

    if (!purchase) {
      throw new NotFoundException('Subscription purchase not found');
    }

    await this.checkAndUpdateExpired(purchase);

    const usageLogs = await this.findUsageLogs(purchase.id, 1, 20);

    return {
      id: purchase.id,
      status: purchase.status,
      paymentStatus: purchase.paymentStatus,
      holderName: purchase.holderName,
      holderImageUrl: purchase.holderImageUrl,
      totalHours:
        purchase.totalHours != null ? Number(purchase.totalHours) : null,
      remainingHours:
        purchase.remainingHours != null
          ? Number(purchase.remainingHours)
          : null,
      dailyHoursLimit:
        purchase.dailyHoursLimit != null
          ? Number(purchase.dailyHoursLimit)
          : null,
      startedAt: purchase.startedAt,
      endsAt: purchase.endsAt,
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
      user: {
        id: purchase.userId,
        name: purchase.holderName || purchase.user?.name || 'User',
        phone: purchase.user?.phone || '',
        email: purchase.user?.email || '',
        imageUrl: purchase.holderImageUrl,
      },
      branch: {
        id: purchase.branchId,
        name: purchase.branch?.name_ar || purchase.branch?.name_en || 'Branch',
      },
      plan: {
        id: purchase.subscriptionPlanId,
        title:
          purchase.subscriptionPlan?.title ||
          purchase.planSnapshot?.title ||
          'Subscription',
        usageMode: this.resolvePurchaseUsageMode(purchase),
        durationMonths:
          purchase.subscriptionPlan?.durationMonths ||
          purchase.planSnapshot?.durationMonths ||
          null,
        price:
          purchase.subscriptionPlan?.price != null
            ? Number(purchase.subscriptionPlan.price)
            : Number(purchase.planSnapshot?.price || 0),
        currency:
          purchase.subscriptionPlan?.currency ||
          purchase.planSnapshot?.currency ||
          'SAR',
        imageUrl:
          purchase.subscriptionPlan?.imageUrl ||
          purchase.planSnapshot?.imageUrl ||
          null,
        description:
          purchase.subscriptionPlan?.description ||
          purchase.planSnapshot?.description ||
          null,
      },
      usageLogs: usageLogs.logs,
    };
  }

  private async getSixthPurchaseLoyaltyStatus(
    userId: string,
    branchId: string,
    subscriptionPlanId: string,
  ) {
    const completedPaidCount = await this.purchaseRepo
      .createQueryBuilder('purchase')
      .where('purchase.userId = :userId', { userId })
      .andWhere('purchase.branchId = :branchId', { branchId })
      .andWhere('purchase.subscriptionPlanId = :subscriptionPlanId', {
        subscriptionPlanId,
      })
      .andWhere('purchase.paymentStatus = :paymentStatus', {
        paymentStatus: 'completed',
      })
      .andWhere(
        "COALESCE(purchase.metadata->>'loyaltyRewardApplied', 'false') <> 'true'",
      )
      .getCount();

    const completedCycles = Math.floor(completedPaidCount / 5);
    const rewardsAlreadyUsed = await this.purchaseRepo
      .createQueryBuilder('purchase')
      .where('purchase.userId = :userId', { userId })
      .andWhere('purchase.branchId = :branchId', { branchId })
      .andWhere('purchase.subscriptionPlanId = :subscriptionPlanId', {
        subscriptionPlanId,
      })
      .andWhere(
        "COALESCE(purchase.metadata->>'loyaltyRewardApplied', 'false') = 'true'",
      )
      .getCount();

    const isEligibleForFreePurchase = completedCycles > rewardsAlreadyUsed;

    return {
      completedPaidPurchases: completedPaidCount,
      purchasesUntilNextFree: isEligibleForFreePurchase
        ? 0
        : completedPaidCount % 5 === 0
          ? 5
          : 5 - (completedPaidCount % 5),
      isEligibleForFreePurchase,
      rewardPurchaseNumber: completedPaidCount + 1,
    };
  }

  /**
   * Check and update expired status (lazy evaluation).
   */
  private async checkAndUpdateExpired(purchase: SubscriptionPurchase) {
    if (
      purchase.status === SubscriptionPurchaseStatus.ACTIVE &&
      purchase.paymentStatus ===
        SubscriptionPurchasePaymentStatus.COMPLETED &&
      purchase.endsAt &&
      new Date() > purchase.endsAt
    ) {
      purchase.status = SubscriptionPurchaseStatus.EXPIRED;
      await this.purchaseRepo.save(purchase);
    }
  }
}
