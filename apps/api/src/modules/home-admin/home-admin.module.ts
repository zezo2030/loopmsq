import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banner } from '../../database/entities/banner.entity';
import { Offer } from '../../database/entities/offer.entity';
import { Activity } from '../../database/entities/activity.entity';
import { OrganizingBranch } from '../../database/entities/organizing-branch.entity';
import { IntroVideo } from '../../database/entities/intro-video.entity';
import { BannerAdminController } from './banner.controller';
import { OfferAdminController } from './offer.controller';
import { ActivityAdminController } from './activity.controller';
import { OrganizingBranchAdminController } from './organizing-branch.controller';
import { IntroVideoAdminController } from './intro-video.controller';
import { HomeAdminService } from './home-admin.service';
import { RedisService } from '../../utils/redis.service';
import { CloudinaryModule } from '../../utils/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Banner,
      Offer,
      Activity,
      OrganizingBranch,
      IntroVideo,
    ]),
    CloudinaryModule,
  ],
  controllers: [
    BannerAdminController,
    OfferAdminController,
    ActivityAdminController,
    OrganizingBranchAdminController,
    IntroVideoAdminController,
  ],
  providers: [HomeAdminService, RedisService],
})
export class HomeAdminModule {}
