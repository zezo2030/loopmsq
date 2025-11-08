import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { User } from '../../database/entities/user.entity';
import { Offer } from '../../database/entities/offer.entity';
import { ContentModule } from '../content/content.module';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Ticket, User, Offer]), ContentModule, CouponsModule, NotificationsModule, RealtimeModule],
  controllers: [BookingsController],
  providers: [BookingsService, QRCodeService, RedisService],
  exports: [BookingsService],
})
export class BookingsModule {}
