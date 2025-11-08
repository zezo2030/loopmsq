import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { Coupon } from '../../database/entities/coupon.entity';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon) private readonly repo: Repository<Coupon>,
  ) {}

  list(filter?: { branchId?: string }) {
    const where: any = {};
    if (filter?.branchId) where.branchId = filter.branchId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } as any });
  }

  listCouponsByBranch(branchId: string) {
    return this.list({ branchId });
  }

  create(dto: Partial<Coupon>) {
    if (!dto.branchId) {
      throw new Error('branchId is required');
    }
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  update(id: string, dto: Partial<Coupon>) {
    return this.repo.update(id, dto);
  }

  remove(id: string) {
    return this.repo.delete(id);
  }

  async preview(
    code: string,
    amount: number,
    options?: { branchId?: string; hallId?: string },
  ) {
    const now = new Date();
    const found = await this.repo.findOne({ where: { code } });
    if (!found) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    if (found.branchId && options?.branchId && found.branchId !== options.branchId) {
      return { valid: false, reason: 'WRONG_BRANCH' };
    }

    if (found.hallId && options?.hallId && found.hallId !== options.hallId) {
      return { valid: false, reason: 'WRONG_HALL' };
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
    const discountAmount =
      found.discountType === 'percentage'
        ? (amount * Number(found.discountValue)) / 100
        : Number(found.discountValue);
    const finalAmount = Math.max(0, amount - discountAmount);
    return { valid: true, discountAmount, finalAmount };
  }
}


