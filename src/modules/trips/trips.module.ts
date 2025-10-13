import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolTripRequest } from '../../database/entities/school-trip-request.entity';
import { Booking } from '../../database/entities/booking.entity';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { UsersModule } from '../users/users.module';
import { PaymentsModule } from '../payments/payments.module';
import { BookingsModule } from '../bookings/bookings.module';
import { RedisService } from '../../utils/redis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SchoolTripRequest, Booking]),
    UsersModule,
    PaymentsModule,
    BookingsModule,
  ],
  controllers: [TripsController],
  providers: [TripsService, RedisService],
})
export class TripsModule {}


