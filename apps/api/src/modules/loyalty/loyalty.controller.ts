import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  @Post('redeem-ticket')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redeem loyalty points for a free ticket' })
  async redeemTicket(
    @CurrentUser() user: User,
    @Body() body: { branchId: string },
  ) {
    return this.loyalty.redeemForTicket(user.id, body.branchId);
  }

  // Admin endpoints
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
  async createRule(
    @Body()
    body: {
      earnRate?: number;
      pointsPerTicket?: number;
      isActive?: boolean;
    },
  ) {
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
  async updateRule(
    @Param('id') id: string,
    @Body()
    body: {
      earnRate?: number;
      pointsPerTicket?: number;
      isActive?: boolean;
    },
  ) {
    return this.loyalty.updateRule(id, body);
  }

  // Wallet management endpoints — open to ADMIN, and to BRANCH_MANAGER only
  // when the admin has granted the `canManageWallets` permission flag.
  @Get('wallets')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'List wallets with pagination (Admin, or Branch Manager with canManageWallets)',
  })
  async listWallets(
    @CurrentUser() user: User,
    @Query() query: ListWalletsDto,
  ) {
    this.ensureCanManageWallets(user);
    return this.loyalty.listWallets(query);
  }

  @Post('wallets/:userId/adjust')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Adjust wallet balance/points (Admin, or Branch Manager with canManageWallets)',
  })
  async adjustWallet(
    @CurrentUser() user: User,
    @Param('userId') userId: string,
    @Body() body: AdjustWalletDto,
  ) {
    this.ensureCanManageWallets(user);
    return this.loyalty.adjustWallet(userId, body);
  }

  @Get(':userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Get a user's loyalty summary (Admin, or Branch Manager with canManageWallets)",
  })
  async getUserSummary(
    @CurrentUser() user: User,
    @Param('userId') userId: string,
  ) {
    this.ensureCanManageWallets(user);
    return this.loyalty.getSummary(userId);
  }

  /** Admins always pass; branch managers require the canManageWallets flag. */
  private ensureCanManageWallets(user: User): void {
    if (user.roles?.includes(UserRole.ADMIN)) return;
    if (
      user.roles?.includes(UserRole.BRANCH_MANAGER) &&
      user.permissions?.canManageWallets === true
    ) {
      return;
    }
    throw new ForbiddenException(
      'You do not have permission to manage wallets',
    );
  }
}
