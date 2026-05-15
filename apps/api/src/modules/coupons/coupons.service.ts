import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { Coupon } from '../../database/entities/coupon.entity';
import { AdminNotificationsService } from '../admin-notifications/admin-notifications.service';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon) private readonly repo: Repository<Coupon>,
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

  async create(dto: Partial<Coupon>) {
    if (!dto.branchId) {
      throw new Error('branchId is required');
    }
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

  update(id: string, dto: Partial<Coupon>) {
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

  async preview(
    code: string,
    amount: number,
    options?: { branchId?: string; hallId?: string | null },
  ) {
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

    // hallId is no longer used, but keep for backward compatibility

    if (!found.isActive) {
      return { valid: false, reason: 'INACTIVE' };
    }
    if (
      (found.startsAt && found.startsAt > now) ||
      (found.endsAt && found.endsAt < now)
    ) {
      return { valid: false, reason: 'OUT_OF_SCHEDULE' };
    }
    const discountAmount =
      found.discountType === 'percentage'
        ? (amount * Number(found.discountValue)) / 100
        : Number(found.discountValue);
    const finalAmount = Math.max(0, amount - discountAmount);
    return { valid: true, discountAmount, finalAmount };
  }
}
