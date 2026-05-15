import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminNotificationsService } from './admin-notifications.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import type { AdminNotificationType } from '../../database/entities/admin-notification.entity';

@ApiTags('admin-notifications')
@Controller('admin/notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(private readonly service: AdminNotificationsService) {}

  private scopedBranchId(user: User): string | undefined {
    if (user.roles?.includes(UserRole.BRANCH_MANAGER) && user.branchId) {
      return user.branchId;
    }
    return undefined;
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  async list(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isRead') isRead?: string,
    @Query('type') type?: string,
  ) {
    return this.service.list({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      isRead:
        isRead === 'true' ? true : isRead === 'false' ? false : undefined,
      branchId: this.scopedBranchId(user),
      type: (type as AdminNotificationType) || undefined,
    });
  }

  @Get('unread-count')
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  async unread(@CurrentUser() user: User) {
    const count = await this.service.unreadCount(this.scopedBranchId(user));
    return { count };
  }

  @Patch('read-all')
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @HttpCode(HttpStatus.OK)
  async readAll(@CurrentUser() user: User) {
    await this.service.markAllRead(this.scopedBranchId(user));
    return { success: true };
  }

  @Patch(':id/read')
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @HttpCode(HttpStatus.OK)
  async read(@Param('id') id: string) {
    await this.service.markRead(id);
    return { success: true };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }
}
