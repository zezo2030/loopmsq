import { Body, Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService, NotificationChannel } from './notifications.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from '../../database/entities/device-token.entity';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    @InjectRepository(DeviceToken) private readonly tokenRepo: Repository<DeviceToken>,
  ) {}

  @Post('promo')
  @HttpCode(HttpStatus.OK)
  async sendPromo(@Body() body: { userId?: string; phone?: string; email?: string; message: string; lang?: 'ar' | 'en'; channels?: NotificationChannel[] }) {
    const channels: NotificationChannel[] = body.channels && body.channels.length ? body.channels : (['sms', 'push'] as NotificationChannel[]);
    await this.notifications.enqueue({
      type: 'PROMO',
      to: { userId: body.userId, phone: body.phone, email: body.email },
      data: { message: body.message },
      lang: body.lang,
      channels,
    });
    return { success: true };
  }

  @Post('register-device')
  @HttpCode(HttpStatus.OK)
  async registerDevice(@Body() body: { userId: string; token: string; platform?: 'android' | 'ios' }) {
    const exists = await this.tokenRepo.findOne({ where: { token: body.token } });
    if (exists) {
      exists.userId = body.userId;
      exists.platform = body.platform || 'android';
      await this.tokenRepo.save(exists);
      return { success: true };
    }
    const rec = this.tokenRepo.create({ userId: body.userId, token: body.token, platform: body.platform || 'android', provider: 'fcm' });
    await this.tokenRepo.save(rec);
    return { success: true };
  }

  @Delete('unregister-device')
  @HttpCode(HttpStatus.OK)
  async unregisterDevice(@Body() body: { token: string }) {
    await this.tokenRepo.delete({ token: body.token });
    return { success: true };
  }
}


