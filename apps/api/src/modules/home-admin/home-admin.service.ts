import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Banner } from '../../database/entities/banner.entity';
import { Offer } from '../../database/entities/offer.entity';

@Injectable()
export class HomeAdminService {
  constructor(
    @InjectRepository(Banner) private readonly bannerRepo: Repository<Banner>,
    @InjectRepository(Offer) private readonly offerRepo: Repository<Offer>,
  ) {}

  // Banner
  listBanners() {
    return this.bannerRepo.find({ order: { createdAt: 'DESC' } as any });
  }
  createBanner(dto: Partial<Banner>) {
    const entity = this.bannerRepo.create(dto);
    return this.bannerRepo.save(entity);
  }
  updateBanner(id: string, dto: Partial<Banner>) {
    return this.bannerRepo.update(id, dto);
  }
  deleteBanner(id: string) {
    return this.bannerRepo.delete(id);
  }

  // Offer
  listOffers() {
    return this.offerRepo.find({ order: { createdAt: 'DESC' } as any });
  }
  createOffer(dto: Partial<Offer>) {
    const entity = this.offerRepo.create(dto);
    return this.offerRepo.save(entity);
  }
  updateOffer(id: string, dto: Partial<Offer>) {
    return this.offerRepo.update(id, dto);
  }
  deleteOffer(id: string) {
    return this.offerRepo.delete(id);
  }
}


