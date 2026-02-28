import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService, NotificationChannel } from './notifications.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from '../../database/entities/device-token.entity';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PromoDto } from './dto/promo.dto';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { PushProvider } from './providers/push.provider';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    @InjectRepository(DeviceToken) private readonly tokenRepo: Repository<DeviceToken>,
    private readonly pushProvider: PushProvider,
  ) { }

  @Post('promo')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async sendPromo(@Body() body: PromoDto) {
    // إرسال فقط عبر Firebase Push لجميع الأجهزة
    await this.notifications.enqueue({
      type: 'PROMO',
      to: {}, // فارغ = إرسال لجميع الأجهزة
      data: { message: body.message },
      lang: body.lang,
      channels: ['push'], // فقط Firebase Push
    });
    return { success: true };
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async getUserNotifications(
    @CurrentUser() user: User,
    @Query() query: NotificationsQueryDto,
  ) {
    return this.notifications.getUserNotifications(
      user.id,
      query.page || 1,
      query.limit || 20,
      query.isRead,
    );
  }

  @Get('unread-count')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async getUnreadCount(@CurrentUser() user: User) {
    const count = await this.notifications.getUnreadCount(user.id);
    return { count };
  }

  @Patch('read-all')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser() user: User) {
    await this.notifications.markAllAsRead(user.id);
    return { success: true };
  }

  @Patch(':id/read')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async markAsRead(@CurrentUser() user: User, @Param('id') id: string) {
    await this.notifications.markAsRead(id, user.id);
    return { success: true };
  }

  @Delete()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async deleteAllNotifications(@CurrentUser() user: User) {
    await this.notifications.deleteAllNotifications(user.id);
    return { success: true };
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async deleteNotification(@CurrentUser() user: User, @Param('id') id: string) {
    await this.notifications.deleteNotification(id, user.id);
    return { success: true };
  }

  @Post('register-device')
  @HttpCode(HttpStatus.OK)
  async registerDevice(@Body() body: { userId?: string; token: string; platform?: 'android' | 'ios' }) {
    const exists = await this.tokenRepo.findOne({ where: { token: body.token } });
    if (exists) {
      // Update existing token
      if (body.userId) {
        exists.userId = body.userId;
      }
      if (body.platform) {
        exists.platform = body.platform;
      }
      await this.tokenRepo.save(exists);
      return { success: true };
    }

    // Create new token
    const rec = this.tokenRepo.create({
      userId: body.userId || null,
      token: body.token,
      platform: body.platform || 'android',
      provider: 'fcm'
    });
    await this.tokenRepo.save(rec);
    return { success: true };
  }

  @Delete('unregister-device')
  @HttpCode(HttpStatus.OK)
  async unregisterDevice(@Body() body: { token: string }) {
    await this.tokenRepo.delete({ token: body.token });
    return { success: true };
  }

  @Get('firebase-status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async getFirebaseStatus() {
    const status = this.pushProvider.getStatus();
    const deviceCount = await this.tokenRepo.count();
    return {
      initialized: status.initialized,
      status: status.initialized ? 'ACTIVE' : (status.error ? 'FAILED' : 'NOT CONFIGURED'),
      projectId: status.projectId,
      error: status.error,
      registeredDevices: deviceCount,
      message: status.initialized
        ? 'Firebase integration is active and push notifications are enabled'
        : (status.error
          ? `Firebase integration failed: ${status.error}`
          : 'Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to enable.'),
    };
  }
}


