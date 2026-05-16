import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EventRequest,
  EventRequestStatus,
} from '../../database/entities/event-request.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { Payment } from '../../database/entities/payment.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { BookingsModule } from '../bookings/bookings.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';
import { ContentModule } from '../content/content.module';
import { AdminConfigModule } from '../admin-config/admin-config.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventRequest, Booking, Ticket, Payment]),
    BookingsModule,
    UsersModule,
    forwardRef(() => NotificationsModule),
    AdminNotificationsModule,
    ContentModule,
    AdminConfigModule,
    CouponsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
