import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from '../../database/entities/coupon.entity';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon])],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}


