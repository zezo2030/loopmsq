import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banner } from '../../database/entities/banner.entity';
import { Offer } from '../../database/entities/offer.entity';
import { BannerAdminController } from './banner.controller';
import { OfferAdminController } from './offer.controller';
import { HomeAdminService } from './home-admin.service';
import { RedisService } from '../../utils/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([Banner, Offer])],
  controllers: [BannerAdminController, OfferAdminController],
  providers: [
    HomeAdminService,
    RedisService,
  ],
})
export class HomeAdminModule {}


