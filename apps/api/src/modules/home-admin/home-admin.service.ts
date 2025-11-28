import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../utils/redis.service';
import { Banner } from '../../database/entities/banner.entity';
import { Offer } from '../../database/entities/offer.entity';
import { Hall } from '../../database/entities/hall.entity';

@Injectable()
export class HomeAdminService {
  constructor(
    @InjectRepository(Banner) private readonly bannerRepo: Repository<Banner>,
    @InjectRepository(Offer) private readonly offerRepo: Repository<Offer>,
    @InjectRepository(Hall) private readonly hallRepo: Repository<Hall>,
    private readonly redis: RedisService,
  ) {}

  // Banner
  listBanners() {
    return this.bannerRepo.find({ order: { createdAt: 'DESC' } as any });
  }
  async createBanner(dto: Partial<Banner>) {
    const entity = this.bannerRepo.create(dto);
    const saved = await this.bannerRepo.save(entity);
    await this.redis.del('home:v1');
    return saved;
  }
  async updateBanner(id: string, dto: Partial<Banner>) {
    const res = await this.bannerRepo.update(id, dto);
    await this.redis.del('home:v1');
    return res;
  }
  async deleteBanner(id: string) {
    const res = await this.bannerRepo.delete(id);
    await this.redis.del('home:v1');
    return res;
  }

  // Offer
  listOffers(filter?: { branchId?: string }) {
    const where: any = {};
    if (filter?.branchId) where.branchId = filter.branchId;
    return this.offerRepo.find({ where, order: { createdAt: 'DESC' } as any });
  }
  async listOffersByBranch(branchId: string) {
    return this.listOffers({ branchId });
  }
  async createOffer(dto: Partial<Offer>) {
    if (!dto.branchId) {
      throw new Error('branchId is required');
    }
    
    // Get the hall for this branch (one-to-one relationship)
    const hall = await this.hallRepo.findOne({
      where: { branchId: dto.branchId },
    });
    
    if (!hall) {
      throw new Error(`No hall found for branch ${dto.branchId}`);
    }
    
    // Automatically link the offer to the branch's hall
    const entity = this.offerRepo.create({
      ...dto,
      hallId: hall.id,
    });
    const saved = await this.offerRepo.save(entity);
    await this.redis.del('home:v1');
    return saved;
  }
  async updateOffer(id: string, dto: Partial<Offer>) {
    // If branchId is being updated, automatically link to the branch's hall
    if (dto.branchId) {
      const hall = await this.hallRepo.findOne({
        where: { branchId: dto.branchId },
      });
      
      if (!hall) {
        throw new Error(`No hall found for branch ${dto.branchId}`);
      }
      
      // Automatically set hallId to the branch's hall
      dto.hallId = hall.id;
    }
    
    const res = await this.offerRepo.update(id, dto);
    await this.redis.del('home:v1');
    return res;
  }
  async deleteOffer(id: string) {
    const res = await this.offerRepo.delete(id);
    await this.redis.del('home:v1');
    return res;
  }
}


