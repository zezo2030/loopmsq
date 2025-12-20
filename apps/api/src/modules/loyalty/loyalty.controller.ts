import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { ListWalletsDto } from './dto/list-wallets.dto';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';

@ApiTags('loyalty')
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get loyalty summary for current user' })
  async getMySummary(@CurrentUser() user: User) {
    return this.loyalty.getSummary(user.id);
  }

  @Post('redeem')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redeem points for current user' })
  async redeem(@CurrentUser() user: User, @Body() body: { points: number }) {
    return this.loyalty.redeemPoints(user.id, body.points);
  }

  // Admin endpoints (assume guarded by roles at controller level later)
  @Get('rules')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List loyalty rules (Admin only)' })
  async listRules() {
    return this.loyalty.listRules();
  }

  @Post('rules')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create loyalty rule (Admin only)' })
  async createRule(@Body() body: { earnRate?: number; redeemRate?: number; minRedeemPoints?: number; isActive?: boolean }) {
    return this.loyalty.createRule(body);
  }

  @Post('rules/:id/activate')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate loyalty rule (Admin only)' })
  async activateRule(@Param('id') id: string) {
    await this.loyalty.setActiveRule(id);
    return { success: true };
  }

  @Patch('rules/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update loyalty rule (Admin only)' })
  async updateRule(@Param('id') id: string, @Body() body: { earnRate?: number; redeemRate?: number; minRedeemPoints?: number; isActive?: boolean }) {
    return this.loyalty.updateRule(id, body);
  }

  // Wallet admin endpoints
  @Get('wallets')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List wallets with pagination (Admin only)' })
  async listWallets(@Query() query: ListWalletsDto) {
    return this.loyalty.listWallets(query);
  }

  @Post('wallets/:userId/adjust')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Adjust wallet balance/points (Admin only)' })
  async adjustWallet(@Param('userId') userId: string, @Body() body: AdjustWalletDto) {
    return this.loyalty.adjustWallet(userId, body);
  }

  @Get(':userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get loyalty summary for a user (Admin only)' })
  async getUserSummary(@Param('userId') userId: string) {
    return this.loyalty.getSummary(userId);
  }
}


