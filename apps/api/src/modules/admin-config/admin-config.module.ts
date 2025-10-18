import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EncryptionService } from '../../utils/encryption.util';
import { RedisService } from '../../utils/redis.service';
import { User } from '../../database/entities/user.entity';
import { DeviceToken } from '../../database/entities/device-token.entity';

@Module({
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([User, DeviceToken]),
  ],
  controllers: [AdminConfigController],
  providers: [AdminConfigService, EncryptionService, RedisService],
})
export class AdminConfigModule {}


