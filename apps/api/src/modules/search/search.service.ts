import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Payment } from '../../database/entities/payment.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
  ) {}

  async searchUsers(q: string, page: number, limit: number) {
    const where = q
      ? [
          { name: ILike(`%${q}%`) } as any,
          { email: ILike(`%${q}%`) } as any,
        ]
      : {};
    const [items, total] = await this.users.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' } as any,
      select: ['id', 'name', 'email', 'roles', 'language', 'createdAt'] as any,
    });
    return { items, total, page, limit };
  }

  async searchBookings(q: string, page: number, limit: number, branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
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

  async searchPayments(q: string, page: number, limit: number) {
    const [items, total] = await this.payments.findAndCount({
      where: {},
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' } as any,
    });
    const filtered = q ? items.filter((p) => p.id.includes(q) || (p.bookingId || '').includes(q)) : items;
    return { items: filtered, total: q ? filtered.length : total, page, limit };
  }
}


