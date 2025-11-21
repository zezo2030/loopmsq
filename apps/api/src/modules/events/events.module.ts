import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventRequest } from '../../database/entities/event-request.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { BookingsModule } from '../bookings/bookings.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [TypeOrmModule.forFeature([EventRequest]), BookingsModule, UsersModule, NotificationsModule, ContentModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}


