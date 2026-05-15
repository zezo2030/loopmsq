import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminNotification } from '../../database/entities/admin-notification.entity';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminNotificationsController } from './admin-notifications.controller';
import { RealtimeModule } from '../../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([AdminNotification]), RealtimeModule],
  controllers: [AdminNotificationsController],
  providers: [AdminNotificationsService],
  exports: [AdminNotificationsService],
})
export class AdminNotificationsModule {}
