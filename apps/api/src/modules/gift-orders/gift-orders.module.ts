import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiftOrder } from '../../database/entities/gift-order.entity';
import { GiftOrderEvent } from '../../database/entities/gift-order-event.entity';
import { Branch } from '../../database/entities/branch.entity';
import { User } from '../../database/entities/user.entity';
import { OfferProduct } from '../../database/entities/offer-product.entity';
import { SubscriptionPlan } from '../../database/entities/subscription-plan.entity';
import { OfferBooking } from '../../database/entities/offer-booking.entity';
import { SubscriptionPurchase } from '../../database/entities/subscription-purchase.entity';
import { Payment } from '../../database/entities/payment.entity';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OfferBookingsModule } from '../offer-bookings/offer-bookings.module';
import { SubscriptionPurchasesModule } from '../subscription-purchases/subscription-purchases.module';
import { GiftOrdersController } from './gift-orders.controller';
import { GiftOrdersService } from './gift-orders.service';
import { GiftOrdersExpiryProcessor } from './gift-orders.expiry.processor';
import { EncryptionService } from '../../utils/encryption.util';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GiftOrder,
      GiftOrderEvent,
      Branch,
      User,
      OfferProduct,
      SubscriptionPlan,
      OfferBooking,
      SubscriptionPurchase,
      Payment,
    ]),
    forwardRef(() => PaymentsModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => OfferBookingsModule),
    forwardRef(() => SubscriptionPurchasesModule),
  ],
  controllers: [GiftOrdersController],
  providers: [GiftOrdersService, GiftOrdersExpiryProcessor, EncryptionService],
  exports: [GiftOrdersService],
})
export class GiftOrdersModule {}
