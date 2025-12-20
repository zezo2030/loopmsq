import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { Banner } from '../../database/entities/banner.entity';
import { Offer } from '../../database/entities/offer.entity';
import { Branch } from '../../database/entities/branch.entity';
import { Activity } from '../../database/entities/activity.entity';
import { OrganizingBranch } from '../../database/entities/organizing-branch.entity';
import { RedisService } from '../../utils/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([Banner, Offer, Branch, Activity, OrganizingBranch])],
  controllers: [HomeController],
  providers: [HomeService, RedisService],
})
export class HomeModule {}


