import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { SubscriptionPurchasesService } from './subscription-purchases.service';
import { SubscriptionQuoteDto } from './dto/subscription-quote.dto';
import { CreateSubscriptionPurchaseDto } from './dto/create-subscription-purchase.dto';
import { DeductHoursDto } from './dto/deduct-hours.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../../database/entities/user.entity';

@ApiTags('subscription-purchases')
@Controller('subscription-purchases')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class SubscriptionPurchasesController {
  constructor(private readonly service: SubscriptionPurchasesService) {}

  @Post('quote')
  @ApiOperation({ summary: 'Get subscription purchase quote' })
  @ApiResponse({ status: 200, description: 'Quote calculated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Plan inactive or outside availability window',
  })
  @ApiResponse({
    status: 409,
    description: 'User already has active subscription',
  })
  async getQuote(@CurrentUser() user: User, @Body() dto: SubscriptionQuoteDto) {
    return this.service.getQuote(user.id, dto);
  }

  @Post('upload-holder-photo')
  @ApiOperation({ summary: 'Upload subscription holder photo' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Photo uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadHolderPhoto(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Subscription holder photo is required');
    }

    return this.service.uploadHolderPhoto(file);
  }

  @Post()
  @ApiOperation({
    summary: 'Create subscription purchase and initiate payment',
  })
  @ApiResponse({ status: 201, description: 'Purchase created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Plan inactive or outside availability window',
  })
  @ApiResponse({
    status: 409,
    description: 'User already has active subscription',
  })
  async createPurchase(
    @CurrentUser() user: User,
    @Body() dto: CreateSubscriptionPurchaseDto,
  ) {
    return this.service.createPurchase(user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get user subscriptions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
  })
  async getUserSubscriptions(
    @CurrentUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('status') status?: string,
  ) {
    return this.service.findUserPurchases(user.id, page, limit, status as any);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all subscription purchases (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'paymentStatus', required: false, type: String })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getAdminSubscriptions(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAdminPurchases(page, limit, {
      status: status as any,
      paymentStatus: paymentStatus as any,
      branchId,
      from,
      to,
      search,
    });
  }

  @Get('branch/me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get branch subscriptions (branch manager)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'paymentStatus', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getBranchSubscriptions(
    @CurrentUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findBranchPurchases(user.branchId!, page, limit, {
      status: status as any,
      paymentStatus: paymentStatus as any,
      from,
      to,
      search,
    });
  }

  @Get('admin/all/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get subscription purchase details (admin)' })
  async getAdminSubscriptionById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findPurchaseForAdmin(id);
  }

  @Get('branch/me/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Get subscription purchase details (branch manager)',
  })
  async getBranchSubscriptionById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findPurchaseForBranch(id, user.branchId!);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription purchase details' })
  @ApiResponse({ status: 200, description: 'Purchase retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  async getPurchase(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findPurchaseById(id, user.id);
  }

  @Get(':id/usage-logs')
  @ApiOperation({ summary: 'Get subscription usage logs (owner)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getOwnerUsageLogs(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.service.findUsageLogsForOwner(id, user.id, page, limit);
  }

  @Get('staff/subscriptions/token/:token')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get subscription preview by token (staff)' })
  @ApiResponse({ status: 200, description: 'Subscription preview retrieved' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getStaffSubscriptionPreview(
    @CurrentUser() user: User,
    @Param('token') token: string,
  ) {
    return this.service.findByToken(token, user.id);
  }

  @Post('staff/subscriptions/deduct-hours')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Deduct hours from subscription (staff)' })
  @ApiResponse({ status: 200, description: 'Hours deducted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid hours or exceeds limits' })
  async deductHours(@CurrentUser() user: User, @Body() dto: DeductHoursDto) {
    return this.service.deductHours(dto, user.id);
  }

  @Get('staff/subscriptions/usage-logs/me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get subscription deduction logs for current staff' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  async getMySubscriptionUsageLogs(
    @CurrentUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.findUsageLogsByStaff(
      user.id,
      page,
      limit,
      dateFrom,
      dateTo,
    );
  }

  @Get('staff/subscriptions/:id/usage-logs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get subscription usage logs (staff)' })
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
