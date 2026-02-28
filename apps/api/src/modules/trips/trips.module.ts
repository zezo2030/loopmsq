import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolTripRequest } from '../../database/entities/school-trip-request.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { User } from '../../database/entities/user.entity';
import { Payment } from '../../database/entities/payment.entity';
import { TripsController } from './trips.controller';
import { TripsPublicController } from './trips-public.controller';
import { TripsService } from './trips.service';
import { UsersModule } from '../users/users.module';
import { PaymentsModule } from '../payments/payments.module';
import { BookingsModule } from '../bookings/bookings.module';
import { RedisService } from '../../utils/redis.service';
import { QRCodeService } from '../../utils/qr-code.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SchoolTripRequest, Booking, Ticket, User, Payment]),
    UsersModule,
    PaymentsModule,
    BookingsModule,
    NotificationsModule,
  ],
  controllers: [TripsController, TripsPublicController],
  providers: [TripsService, RedisService, QRCodeService],
})
export class TripsModule { }


