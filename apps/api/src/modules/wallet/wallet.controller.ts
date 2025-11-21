import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { RechargeWalletDto } from './dto/recharge-wallet.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';

@ApiTags('wallet')
@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('recharge')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recharge wallet with payment gateway' })
  @ApiResponse({ status: 200, description: 'Wallet recharge initiated' })
  @ApiResponse({ status: 400, description: 'Invalid request or insufficient funds' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async rechargeWallet(
    @CurrentUser() user: User,
    @Body() dto: RechargeWalletDto,
  ) {
    return this.walletService.rechargeWallet(user.id, dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get wallet balance and summary for current user' })
  @ApiResponse({ status: 200, description: 'Wallet balance retrieved' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWalletBalance(@CurrentUser() user: User) {
    return this.walletService.getWalletBalance(user.id);
  }

  @Get('me/transactions')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get wallet transactions history for current user' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWalletTransactions(
    @CurrentUser() user: User,
    @Query() query: ListTransactionsDto,
  ) {
    return this.walletService.getWalletTransactions(user.id, query);
  }
}
