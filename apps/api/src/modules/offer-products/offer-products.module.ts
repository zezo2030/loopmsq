import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfferProduct } from '../../database/entities/offer-product.entity';
import { Addon } from '../../database/entities/addon.entity';
import { OfferProductsController } from './offer-products.controller';
import { OfferProductsService } from './offer-products.service';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OfferProduct, Addon]),
    AdminNotificationsModule,
  ],
  controllers: [OfferProductsController],
  providers: [OfferProductsService],
  exports: [OfferProductsService],
})
export class OfferProductsModule {}
