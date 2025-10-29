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

  async getHome(branchId?: string) {
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
    // Build where conditions for offers
    const baseOfferWhere: any = { isActive: true };
    
    if (branchId) {
      baseOfferWhere.branchId = branchId;
    }
    // If no branchId filter, we'll still get offers but old ones (without branchId) won't display properly
    
    const timeConditions = [
      { ...baseOfferWhere, startsAt: IsNull(), endsAt: IsNull() },
      { ...baseOfferWhere, startsAt: LessThanOrEqual(now), endsAt: IsNull() },
      { ...baseOfferWhere, startsAt: IsNull(), endsAt: MoreThanOrEqual(now) },
      { ...baseOfferWhere, startsAt: LessThanOrEqual(now), endsAt: MoreThanOrEqual(now) },
    ];
    
    const offers = await this.offerRepo.find({
      where: timeConditions as any,
      order: { createdAt: 'DESC' },
    });
    
    // Filter out offers without branchId (old data) if no specific branch requested
    const filteredOffers = branchId 
      ? offers 
      : offers.filter(o => o.branchId !== null);
    const featuredBranches = await this.branchRepo.find({ order: { createdAt: 'DESC' }, take: 10 });
    const payload = { banners, offers: filteredOffers, featuredBranches };
    await this.redis.set(cacheKey, payload, 120);
    return payload;
  }
}


