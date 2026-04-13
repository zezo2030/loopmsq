import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
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
import { CreateSubscriptionPurchaseDto } from './dto/create-subscription-purchase.dto';
import { DeductHoursDto } from './dto/deduct-hours.dto';
import { User } from '../../database/entities/user.entity';

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
    private readonly dataSource: DataSource,
  ) {}

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

    // Check if user already has active subscription in this branch
    const existingActive = await this.purchaseRepo.findOne({
      where: {
        userId,
        branchId: plan.branchId,
        status: SubscriptionPurchaseStatus.ACTIVE,
      },
    });

    if (existingActive) {
      throw new ConflictException(
        'User already has an active subscription in this branch',
      );
    }

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

  /**
   * Create a subscription purchase and initiate payment.
   */
  async createPurchase(userId: string, dto: CreateSubscriptionPurchaseDto) {
    const plan = await this.findActivePlan(dto.subscriptionPlanId);
    if (!dto.acceptedTerms) {
      throw new BadRequestException(
        'Subscription terms and conditions must be accepted',
      );
    }

    // Check if user already has active subscription in this branch
    const existingActive = await this.purchaseRepo.findOne({
      where: {
        userId,
        branchId: plan.branchId,
        status: SubscriptionPurchaseStatus.ACTIVE,
      },
    });

    if (existingActive) {
      throw new ConflictException(
        'User already has an active subscription in this branch',
      );
    }

    const loyaltyStatus = await this.getSixthPurchaseLoyaltyStatus(
      userId,
      plan.branchId,
      plan.id,
    );
    const totalPrice = loyaltyStatus.isEligibleForFreePurchase
      ? 0
      : Number(plan.price);
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
        paymentStatus: 'pending' as any,
        status: SubscriptionPurchaseStatus.ACTIVE,
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
    if (!staff?.branchId || staff.branchId !== purchase.branchId) {
      const b = purchase.branch;
      const ticketBranchName = b?.name_ar || b?.name_en || '';
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
    const usageMode =
      purchase.planSnapshot?.usageMode ||
      purchase.subscriptionPlan?.usageMode ||
      SubscriptionUsageMode.DAILY_LIMITED;
    const dailyRemainingToday =
      purchase.dailyHoursLimit != null
        ? Number(purchase.dailyHoursLimit) - dailyUsedToday
        : null;

    return {
      subscription: {
        id: purchase.id,
        status: purchase.status,
        totalHours: purchase.totalHours,
        remainingHours: purchase.remainingHours,
        dailyHoursLimit: purchase.dailyHoursLimit,
        dailyUsedToday,
        dailyRemainingToday,
        usageMode,
        canDeductHours: usageMode !== SubscriptionUsageMode.DAILY_UNLIMITED,
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
        name: purchase.user?.name || 'User',
        phone: purchase.user?.phone || '',
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
      relations: ['branch'],
    });

    if (!purchase) {
      throw new NotFoundException('Subscription not found');
    }

    await this.assertStaffSubscriptionBranch(staffId, purchase);

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

    const usageMode =
      purchase.planSnapshot?.usageMode || SubscriptionUsageMode.DAILY_LIMITED;

    if (usageMode === SubscriptionUsageMode.DAILY_UNLIMITED) {
      throw new BadRequestException(
        'Unlimited daily subscriptions do not require hour deduction',
      );
    }

    if (hours > Number(purchase.remainingHours || 0)) {
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
    const remainingHoursAfter = remainingHoursBefore - hours;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update purchase
      purchase.remainingHours = remainingHoursAfter;

      if (remainingHoursAfter <= 0) {
        purchase.status = SubscriptionPurchaseStatus.DEPLETED;
        purchase.remainingHours = 0;
      }

      await queryRunner.manager.save(SubscriptionPurchase, purchase);

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
        message: 'Hours deducted successfully',
        subscription: {
          remainingHours: remainingHoursAfter,
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
      relations: ['branch'],
    });
    if (!purchase) {
      throw new NotFoundException('Subscription not found');
    }
    await this.assertStaffSubscriptionBranch(staffId, purchase);
    return this.findUsageLogs(purchaseId, page, limit);
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
        `SUM(CASE WHEN purchase.status = :activeStatus THEN 1 ELSE 0 END)`,
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
          name: purchase.user?.name || 'User',
          phone: purchase.user?.phone || '',
          email: purchase.user?.email || '',
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
          usageMode:
            purchase.subscriptionPlan?.usageMode ||
            purchase.planSnapshot?.usageMode ||
            SubscriptionUsageMode.DAILY_LIMITED,
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
        name: purchase.user?.name || 'User',
        phone: purchase.user?.phone || '',
        email: purchase.user?.email || '',
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
        usageMode:
          purchase.subscriptionPlan?.usageMode ||
          purchase.planSnapshot?.usageMode ||
          SubscriptionUsageMode.DAILY_LIMITED,
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
      purchase.endsAt &&
      new Date() > purchase.endsAt
    ) {
      purchase.status = SubscriptionPurchaseStatus.EXPIRED;
      await this.purchaseRepo.save(purchase);
    }
  }
}
