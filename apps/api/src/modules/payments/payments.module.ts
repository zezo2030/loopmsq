import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from '../../database/entities/payment.entity';
import { Booking } from '../../database/entities/booking.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsModule } from '../bookings/bookings.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { RedisService } from '../../utils/redis.service';
import { RealtimeModule } from '../../realtime/realtime.module';
import { TapService } from '../../integrations/tap/tap.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Booking]),
    UsersModule,
    NotificationsModule,
    BookingsModule,
    LoyaltyModule,
    WalletModule,
    ReferralsModule,
    RealtimeModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, RedisService, TapService],
  exports: [PaymentsService],
})
export class PaymentsModule {}


