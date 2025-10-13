import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../database/entities/ticket.entity';
import { Booking } from '../../database/entities/booking.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, Booking])],
  controllers: [TicketsController],
  providers: [TicketsService, QRCodeService, RedisService],
})
export class TicketsModule {}


