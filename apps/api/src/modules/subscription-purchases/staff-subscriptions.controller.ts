import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../../database/entities/user.entity';
import { DeductHoursDto } from './dto/deduct-hours.dto';
import { SubscriptionPurchasesService } from './subscription-purchases.service';

@ApiTags('staff-subscriptions')
@Controller('staff/subscriptions')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class StaffSubscriptionsController {
  constructor(private readonly service: SubscriptionPurchasesService) {}

  @Get('token/:token')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Compatibility route: get subscription preview by token (staff)',
  })
  @ApiResponse({ status: 200, description: 'Subscription preview retrieved' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getSubscriptionPreview(
    @CurrentUser() user: User,
    @Param('token') token: string,
  ) {
    return this.service.findByToken(token, user.id);
  }

  @Post('deduct-hours')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Compatibility route: deduct hours from subscription (staff)',
  })
  @ApiResponse({ status: 200, description: 'Hours deducted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid hours or exceeds limits' })
  async deductHours(@CurrentUser() user: User, @Body() dto: DeductHoursDto) {
    return this.service.deductHours(dto, user.id);
  }

  @Get(':id/usage-logs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Compatibility route: get subscription usage logs (staff)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Usage logs retrieved successfully',
  })
  async getUsageLogs(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.service.findUsageLogsForStaff(id, user.id, page, limit);
  }
}
