import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../utils/redis.service';
import { Banner } from '../../database/entities/banner.entity';
import { Offer } from '../../database/entities/offer.entity';
import { Activity } from '../../database/entities/activity.entity';

@Injectable()
export class HomeAdminService {
  constructor(
    @InjectRepository(Banner) private readonly bannerRepo: Repository<Banner>,
    @InjectRepository(Offer) private readonly offerRepo: Repository<Offer>,
    @InjectRepository(Activity) private readonly activityRepo: Repository<Activity>,
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
    
    // Create offer linked to branch (halls are now merged into branches)
    const entity = this.offerRepo.create({
      ...dto,
    });
    const saved = await this.offerRepo.save(entity);
    await this.redis.del('home:v1');
    return saved;
  }
  async updateOffer(id: string, dto: Partial<Offer>) {
    // Update offer (halls are now merged into branches, no need for hallId)
    const res = await this.offerRepo.update(id, dto);
    await this.redis.del('home:v1');
    return res;
  }
  async deleteOffer(id: string) {
    const res = await this.offerRepo.delete(id);
    await this.redis.del('home:v1');
    return res;
  }

  // Activity
  listActivities() {
    return this.activityRepo.find({ order: { createdAt: 'DESC' } as any });
  }

  async createActivity(dto: Partial<Activity>) {
    // Validate: must have either imageUrl or videoUrl, but not both
    if (!dto.imageUrl && !dto.videoUrl) {
      throw new BadRequestException('Either imageUrl or videoUrl must be provided');
    }
    if (dto.imageUrl && dto.videoUrl) {
      throw new BadRequestException('Cannot have both imageUrl and videoUrl');
    }

    // Validate YouTube URL format if videoUrl is provided
    if (dto.videoUrl) {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
      if (!youtubeRegex.test(dto.videoUrl)) {
        throw new BadRequestException('Invalid YouTube URL format');
      }
    }

    const entity = this.activityRepo.create(dto);
    const saved = await this.activityRepo.save(entity);
    await this.redis.del('home:v1');
    return saved;
  }

  async updateActivity(id: string, dto: Partial<Activity>) {
    // Validate: if both are being set, ensure only one is provided
    if (dto.imageUrl !== undefined && dto.videoUrl !== undefined) {
      if (dto.imageUrl && dto.videoUrl) {
        throw new BadRequestException('Cannot have both imageUrl and videoUrl');
      }
      if (!dto.imageUrl && !dto.videoUrl) {
        throw new BadRequestException('Either imageUrl or videoUrl must be provided');
      }
    }

    // Validate YouTube URL format if videoUrl is provided
    if (dto.videoUrl) {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
      if (!youtubeRegex.test(dto.videoUrl)) {
        throw new BadRequestException('Invalid YouTube URL format');
      }
    }

    const res = await this.activityRepo.update(id, dto);
    await this.redis.del('home:v1');
    return res;
  }

  async deleteActivity(id: string) {
    const res = await this.activityRepo.delete(id);
    await this.redis.del('home:v1');
    return res;
  }
}


