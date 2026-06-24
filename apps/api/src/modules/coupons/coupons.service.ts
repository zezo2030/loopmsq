import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Coupon } from '../../database/entities/coupon.entity';
import { CouponRedemption } from '../../database/entities/coupon-redemption.entity';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';

export interface CouponPreviewResult {
  valid: boolean;
  reason?: string;
  discountAmount?: number;
  finalAmount?: number;
}

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    @InjectRepository(Coupon) private readonly repo: Repository<Coupon>,
    @InjectRepository(CouponRedemption)
    private readonly redemptionRepo: Repository<CouponRedemption>,
    private readonly dataSource: DataSource,
    private readonly adminNotifications: AdminNotificationsService,
  ) {}

  list(filter?: { branchId?: string }) {
    const where: any = {};
    if (filter?.branchId) where.branchId = filter.branchId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } as any });
  }

  listCouponsByBranch(branchId: string) {
    return this.list({ branchId });
  }

  /** Reject nonsensical discount configuration before persisting. */
  private validateDiscountConfig(dto: Partial<Coupon>) {
    if (
      dto.discountType === 'percentage' &&
      dto.discountValue != null &&
      Number(dto.discountValue) > 100
    ) {
      throw new BadRequestException(
        'Percentage discount cannot exceed 100%',
      );
    }
    if (dto.discountValue != null && Number(dto.discountValue) < 0) {
      throw new BadRequestException('Discount value cannot be negative');
    }
  }

  async create(dto: Partial<Coupon>) {
    if (!dto.branchId) {
      throw new Error('branchId is required');
    }
    this.validateDiscountConfig(dto);
    const entity = this.repo.create(dto);
    const saved = await this.repo.save(entity);
    await this.adminNotifications.notify({
      type: 'COUPON_CREATED',
      severity: 'info',
      title: 'كوبون جديد',
      body: `${saved.code} — خصم ${saved.discountValue}${saved.discountType === 'percentage' ? '%' : ''}`,
      branchId: saved.branchId || null,
      resourceType: 'coupon',
      resourceId: saved.id,
      data: {
        code: saved.code,
        discountType: saved.discountType,
        discountValue: saved.discountValue,
      },
    });
    return saved;
  }

  async update(id: string, dto: Partial<Coupon>) {
    // Validate against the resulting state (merge stored type when only the
    // value is being changed, and vice-versa).
    if (dto.discountValue != null || dto.discountType != null) {
      const current = await this.repo.findOne({ where: { id } });
      this.validateDiscountConfig({
        discountType: dto.discountType ?? current?.discountType,
        discountValue: dto.discountValue ?? current?.discountValue,
      });
    }
    return this.repo.update(id, dto as any);
  }

  async remove(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    const res = await this.repo.delete(id);
    if (found) {
      await this.adminNotifications.notify({
        type: 'COUPON_DELETED',
        severity: 'warning',
        title: 'تم حذف كوبون',
        body: found.code,
        branchId: found.branchId || null,
        resourceType: 'coupon',
        resourceId: found.id,
      });
    }
    return res;
  }

  /** Compute the discount a coupon grants on `amount`, capped and floored. */
  private computeDiscount(coupon: Coupon, amount: number) {
    const raw =
      coupon.discountType === 'percentage'
        ? (amount * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);
    let discountAmount = raw;
    if (coupon.maxDiscountAmount != null) {
      discountAmount = Math.min(discountAmount, Number(coupon.maxDiscountAmount));
    }
    // Never discount more than the order, never negative.
    discountAmount = Math.max(0, Math.min(discountAmount, amount));
    const finalAmount = Math.max(0, amount - discountAmount);
    return { discountAmount, finalAmount };
  }

  /**
   * Validate a coupon (existence, branch, schedule, active, and usage limits)
   * without recording anything. When `userId` is supplied, per-user limits are
   * enforced too. Returns `{ valid: false, reason }` rather than throwing so
   * existing quote/preview callers keep working.
   */
  async preview(
    code: string,
    amount: number,
    options?: { branchId?: string; hallId?: string | null; userId?: string },
  ): Promise<CouponPreviewResult> {
    const now = new Date();
    const found = await this.repo.findOne({ where: { code } });
    if (!found) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    if (
      found.branchId &&
      options?.branchId &&
      found.branchId !== options.branchId
    ) {
      return { valid: false, reason: 'WRONG_BRANCH' };
    }

    if (!found.isActive) {
      return { valid: false, reason: 'INACTIVE' };
    }
    if (
      (found.startsAt && found.startsAt > now) ||
      (found.endsAt && found.endsAt < now)
    ) {
      return { valid: false, reason: 'OUT_OF_SCHEDULE' };
    }

    // Global usage limit.
    if (found.usageLimit != null && Number(found.usageCount) >= found.usageLimit) {
      return { valid: false, reason: 'USAGE_LIMIT_REACHED' };
    }

    // Per-user usage limit.
    if (found.perUserLimit != null && options?.userId) {
      const userCount = await this.redemptionRepo.count({
        where: { couponId: found.id, userId: options.userId },
      });
      if (userCount >= found.perUserLimit) {
        return { valid: false, reason: 'USER_LIMIT_REACHED' };
      }
    }

    const { discountAmount, finalAmount } = this.computeDiscount(found, amount);
    return { valid: true, discountAmount, finalAmount };
  }

  /**
   * Atomically consume a coupon for a user. Locks the coupon row, re-validates
   * everything (schedule/active/branch/limits), records a redemption, and
   * increments usageCount. Idempotent per (coupon, reference): replaying the
   * same consumption returns the prior result without double-counting.
   *
   * Throws BadRequestException when the coupon is invalid or exhausted — call
   * it at the moment of consumption (after the user is committed to paying),
   * and the up-front `preview()` gate keeps the throw path rare.
   *
   * Pass an existing `manager` to enlist in the caller's transaction.
   */
  async redeem(
    params: {
      code: string;
      userId: string;
      amount: number;
      reference: string;
      branchId?: string;
    },
    manager?: EntityManager,
  ): Promise<{ discountAmount: number; finalAmount: number }> {
    const run = (m: EntityManager) => this.redeemInTx(m, params);
    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  private async redeemInTx(
    manager: EntityManager,
    params: {
      code: string;
      userId: string;
      amount: number;
      reference: string;
      branchId?: string;
    },
  ): Promise<{ discountAmount: number; finalAmount: number }> {
    const couponRepo = manager.getRepository(Coupon);
    const redemptionRepo = manager.getRepository(CouponRedemption);
    const now = new Date();

    const coupon = await couponRepo.findOne({
      where: { code: params.code },
      lock: { mode: 'pessimistic_write' },
    });
    if (!coupon) throw new BadRequestException('Invalid coupon code');

    // Idempotency: this consumption was already recorded.
    const existing = await redemptionRepo.findOne({
      where: { couponId: coupon.id, reference: params.reference },
    });
    if (existing) {
      return {
        discountAmount: Number(existing.discountAmount),
        finalAmount: Math.max(
          0,
          Number(params.amount) - Number(existing.discountAmount),
        ),
      };
    }

    if (coupon.branchId && params.branchId && coupon.branchId !== params.branchId) {
      throw new BadRequestException('Coupon is not valid for this branch');
    }
    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is inactive');
    }
    if (
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.endsAt && coupon.endsAt < now)
    ) {
      throw new BadRequestException('Coupon is outside its valid window');
    }
    if (
      coupon.usageLimit != null &&
      Number(coupon.usageCount) >= coupon.usageLimit
    ) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (coupon.perUserLimit != null) {
      const userCount = await redemptionRepo.count({
        where: { couponId: coupon.id, userId: params.userId },
      });
      if (userCount >= coupon.perUserLimit) {
        throw new BadRequestException(
          'Coupon usage limit reached for this user',
        );
      }
    }

    const { discountAmount, finalAmount } = this.computeDiscount(
      coupon,
      Number(params.amount),
    );

    const redemption = redemptionRepo.create({
      couponId: coupon.id,
      userId: params.userId,
      reference: params.reference,
      code: coupon.code,
      orderAmount: Number(params.amount),
      discountAmount,
    });
    await redemptionRepo.save(redemption);

    coupon.usageCount = Number(coupon.usageCount) + 1;
    await couponRepo.save(coupon);

    return { discountAmount, finalAmount };
  }

  /**
   * Best-effort redemption recording for flows where the coupon was already
   * validated and the user has paid. Never throws — a recording failure must
   * not break a completed purchase; the up-front preview() gate is the real
   * enforcement point. Returns true if a redemption was recorded/confirmed.
   */
  async tryRedeem(params: {
    code?: string | null;
    userId: string;
    amount: number;
    reference: string;
    branchId?: string;
  }): Promise<boolean> {
    if (!params.code || !params.code.trim()) return false;
    try {
      await this.redeem({
        code: params.code.trim(),
        userId: params.userId,
        amount: Number(params.amount),
        reference: params.reference,
        branchId: params.branchId,
      });
      return true;
    } catch (e: any) {
      this.logger.warn(
        `Coupon redemption recording failed (code=${params.code}, ref=${params.reference}): ${e?.message || e}`,
      );
      return false;
    }
  }
}
