import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from '../../database/entities/coupon.entity';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon]), AdminNotificationsModule],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
