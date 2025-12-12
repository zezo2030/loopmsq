import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventRequest, EventRequestStatus } from '../../database/entities/event-request.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { Payment } from '../../database/entities/payment.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { BookingsModule } from '../bookings/bookings.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [TypeOrmModule.forFeature([EventRequest, Booking, Ticket, Payment]), BookingsModule, UsersModule, NotificationsModule, ContentModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule { }


