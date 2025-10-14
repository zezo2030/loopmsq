import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { Coupon } from '../../database/entities/coupon.entity';

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon) private readonly repo: Repository<Coupon>,
  ) {}

  list() {
    return this.repo.find({ order: { createdAt: 'DESC' } as any });
  }

  create(dto: Partial<Coupon>) {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  update(id: string, dto: Partial<Coupon>) {
    return this.repo.update(id, dto);
  }

  remove(id: string) {
    return this.repo.delete(id);
  }

  async preview(code: string, amount: number) {
    const now = new Date();
    const found = await this.repo.findOne({ where: { code } });
    if (!found) {
      return { valid: false, reason: 'NOT_FOUND' };
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


