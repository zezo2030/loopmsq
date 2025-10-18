import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { SmsProcessor } from './processors/sms.processor';
import { EmailProcessor } from './processors/email.processor';
import { SmsProvider } from './providers/sms.provider';
import { EmailProvider } from './providers/email.provider';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { EncryptionService } from '../../utils/encryption.util';
import { NotificationsController } from './notifications.controller';
import { DeviceToken } from '../../database/entities/device-token.entity';
import { PushProvider } from './providers/push.provider';
import { PushProcessor } from './processors/push.processor';
import { RedisService } from '../../utils/redis.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, DeviceToken]),
    BullModule.registerQueue(
      { name: 'notifications_sms' },
      { name: 'notifications_email' },
      { name: 'notifications_push' },
    ),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, SmsProcessor, EmailProcessor, PushProcessor, SmsProvider, EmailProvider, PushProvider, EncryptionService, RedisService],
  exports: [NotificationsService],
})
export class NotificationsModule {}


