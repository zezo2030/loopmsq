import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from '../../database/entities/payment.entity';
import { Booking } from '../../database/entities/booking.entity';
import { EventRequest } from '../../database/entities/event-request.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsModule } from '../bookings/bookings.module';
import { EventsModule } from '../events/events.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { RedisService } from '../../utils/redis.service';
import { RealtimeModule } from '../../realtime/realtime.module';
import { MoyasarService } from '../../integrations/moyasar/moyasar.service';
import { QRCodeService } from '../../utils/qr-code.service';
import { OfferBookingsModule } from '../offer-bookings/offer-bookings.module';
import { SubscriptionPurchasesModule } from '../subscription-purchases/subscription-purchases.module';
import { GiftOrdersModule } from '../gift-orders/gift-orders.module';
import { TripsModule } from '../trips/trips.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Booking, EventRequest]),
    UsersModule,
    NotificationsModule,
    BookingsModule,
    EventsModule,
    LoyaltyModule,
    WalletModule,
    ReferralsModule,
    RealtimeModule,
    OfferBookingsModule,
    SubscriptionPurchasesModule,
    forwardRef(() => GiftOrdersModule),
    forwardRef(() => TripsModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, RedisService, MoyasarService, QRCodeService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
