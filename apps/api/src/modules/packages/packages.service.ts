import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventPackage } from '../../database/entities/event-package.entity';

@Injectable()
export class PackagesService {
  constructor(
    @InjectRepository(EventPackage) private readonly repo: Repository<EventPackage>,
  ) {}

  list(filters?: { branchId?: string; eventType?: string }) {
    const where: any = {};
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.eventType) where.eventType = filters.eventType;
    return this.repo.find({ where, order: { createdAt: 'DESC' } as any });
  }

  create(dto: Partial<EventPackage>) {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  update(id: string, dto: Partial<EventPackage>) {
    return this.repo.update(id, dto);
  }

  remove(id: string) {
    return this.repo.delete(id);
  }

  async preview(packageId: string, persons: number, durationHours: number) {
    const pkg = await this.repo.findOne({ where: { id: packageId } });
    if (!pkg) return { valid: false, reason: 'NOT_FOUND' };
    const now = new Date();
    if (!pkg.isActive) return { valid: false, reason: 'INACTIVE' };
    if ((pkg.startsAt && pkg.startsAt > now) || (pkg.endsAt && pkg.endsAt < now)) {
      return { valid: false, reason: 'OUT_OF_SCHEDULE' };
    }
    if (pkg.minPersons && persons < pkg.minPersons) return { valid: false, reason: 'MIN_PERSONS' };
    if (pkg.maxPersons && persons > pkg.maxPersons) return { valid: false, reason: 'MAX_PERSONS' };
    if (pkg.minDuration && durationHours < pkg.minDuration) return { valid: false, reason: 'MIN_DURATION' };
    if (pkg.maxDuration && durationHours > pkg.maxDuration) return { valid: false, reason: 'MAX_DURATION' };

    const base = Number(pkg.basePrice);
    const perPerson = Number(pkg.pricePerPerson) * persons;
    const perHour = Number(pkg.pricePerHour) * durationHours;
    const total = Math.max(0, base + perPerson + perHour);
    const priceBreakdown = { base, perPerson, perHour };
    return { valid: true, priceBreakdown, total };
  }
}


