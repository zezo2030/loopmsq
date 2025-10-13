import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banner } from '../../database/entities/banner.entity';
import { Offer } from '../../database/entities/offer.entity';
import { BannerAdminController } from './banner.controller';
import { OfferAdminController } from './offer.controller';
import { HomeAdminService } from './home-admin.service';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Banner, Offer])],
  controllers: [BannerAdminController, OfferAdminController],
  providers: [
    HomeAdminService,
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
})
export class HomeAdminModule {}


