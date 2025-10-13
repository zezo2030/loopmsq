import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, IsNull } from 'typeorm';
import { Banner } from '../../database/entities/banner.entity';
import { Offer } from '../../database/entities/offer.entity';
import { Branch } from '../../database/entities/branch.entity';
import { RedisService } from '../../utils/redis.service';

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(Banner) private readonly bannerRepo: Repository<Banner>,
    @InjectRepository(Offer) private readonly offerRepo: Repository<Offer>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    private readonly redis: RedisService,
  ) {}

  async getHome() {
    const cacheKey = 'home:v1';
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;
    const now = new Date();
    const banners = await this.bannerRepo.find({
      where: [
        { isActive: true, startsAt: IsNull(), endsAt: IsNull() },
        { isActive: true, startsAt: LessThanOrEqual(now), endsAt: IsNull() },
        { isActive: true, startsAt: IsNull(), endsAt: MoreThanOrEqual(now) },
        { isActive: true, startsAt: LessThanOrEqual(now), endsAt: MoreThanOrEqual(now) },
      ] as any,
      order: { createdAt: 'DESC' },
    });
    const offers = await this.offerRepo.find({
      where: [
        { isActive: true, startsAt: IsNull(), endsAt: IsNull() },
        { isActive: true, startsAt: LessThanOrEqual(now), endsAt: IsNull() },
        { isActive: true, startsAt: IsNull(), endsAt: MoreThanOrEqual(now) },
        { isActive: true, startsAt: LessThanOrEqual(now), endsAt: MoreThanOrEqual(now) },
      ] as any,
      order: { createdAt: 'DESC' },
    });
    const featuredBranches = await this.branchRepo.find({ order: { createdAt: 'DESC' }, take: 10 });
    const payload = { banners, offers, featuredBranches };
    await this.redis.set(cacheKey, payload, 120);
    return payload;
  }
}


