import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { User } from '../../database/entities/user.entity';
import { ContentModule } from '../content/content.module';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Ticket, User]),
    ContentModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, QRCodeService, RedisService],
  exports: [BookingsService],
})
export class BookingsModule {}
