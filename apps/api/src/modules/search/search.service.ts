import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Payment } from '../../database/entities/payment.entity';
import { UserRole } from '../../common/decorators/roles.decorator';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
  ) {}

  async searchUsers(q: string, page: number, limit: number, requester?: User) {
    const qb = this.users
      .createQueryBuilder('user')
      .select(['user.id', 'user.name', 'user.email', 'user.roles', 'user.language', 'user.createdAt'])
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (requester?.roles?.includes(UserRole.BRANCH_MANAGER) && requester.branchId) {
      qb.andWhere('user.branchId = :branchId', { branchId: requester.branchId });
    }

    if (q) {
      qb.andWhere('(user.name ILIKE :q OR user.email ILIKE :q)', { q: `%${q}%` });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async searchBookings(q: string, page: number, limit: number, branchId?: string, requester?: User) {
    const where: any = {};
    const effectiveBranchId = requester?.roles?.includes(UserRole.BRANCH_MANAGER) ? requester.branchId : branchId;
    if (effectiveBranchId) where.branchId = effectiveBranchId;
    // permit partial match by id
    const [items, total] = await this.bookings.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' } as any,
    });
    const filtered = q ? items.filter((b) => b.id.includes(q)) : items;
    return { items: filtered, total: q ? filtered.length : total, page, limit };
  }

  async searchPayments(q: string, page: number, limit: number, requester?: User) {
    const qb = this.payments
      .createQueryBuilder('payment')
      .leftJoin('payment.booking', 'booking')
      .orderBy('payment.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (requester?.roles?.includes(UserRole.BRANCH_MANAGER) && requester.branchId) {
      qb.andWhere('booking.branchId = :branchId', { branchId: requester.branchId });
    }

    const [items, total] = await qb.getManyAndCount();
    const filtered = q ? items.filter((p) => p.id.includes(q) || (p.bookingId || '').includes(q)) : items;
    return { items: filtered, total: q ? filtered.length : total, page, limit };
  }
}


