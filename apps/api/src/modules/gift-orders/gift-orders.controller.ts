import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GiftOrdersService } from './gift-orders.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GiftQuoteDto } from './dto/gift-quote.dto';
import { CreateGiftOrderDto } from './dto/create-gift-order.dto';
import { ClaimGiftDto } from './dto/claim-gift.dto';
import { ListGiftOrdersDto } from './dto/list-gift-orders.dto';
import { CancelGiftDto } from './dto/cancel-gift.dto';
import { ResolveClaimTokenDto } from './dto/resolve-claim-token.dto';
import { ListGiftRefundRequestsDto } from './dto/list-gift-refund-requests.dto';
import { ReviewGiftRefundDto } from './dto/review-gift-refund.dto';

@ApiTags('gift-orders')
@ApiBearerAuth()
@Controller('gift-orders')
export class GiftOrdersController {
  constructor(private readonly giftOrdersService: GiftOrdersService) {}

  @Post('quote')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get gift pricing quote' })
  async getQuote(@Request() req: any, @Body() dto: GiftQuoteDto) {
    return this.giftOrdersService.getQuote(req.user.id, dto);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Create a gift order' })
  async createGiftOrder(@Request() req: any, @Body() dto: CreateGiftOrderDto) {
    return this.giftOrdersService.createGiftOrder(req.user.id, dto);
  }

  @Get('me/sent')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get sent gifts' })
  async getSentGifts(@Request() req: any, @Query() query: ListGiftOrdersDto) {
    return this.giftOrdersService.getSentGifts(req.user.id, query);
  }

  @Get('me/received')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get received gifts' })
  async getReceivedGifts(
    @Request() req: any,
    @Query() query: ListGiftOrdersDto,
  ) {
    return this.giftOrdersService.getReceivedGifts(req.user.id, query);
  }

  @Get('claim/resolve')
  @ApiOperation({ summary: 'Resolve claim token to gift metadata' })
  async resolveClaimToken(@Query() query: ResolveClaimTokenDto) {
    return this.giftOrdersService.resolveClaimToken(query.token);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get gift details' })
  async getGiftDetails(@Request() req: any, @Param('id') id: string) {
    return this.giftOrdersService.getGiftDetails(req.user.id, id);
  }

  @Post(':id/claim')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Claim a gift' })
  async claimGift(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ClaimGiftDto,
  ) {
    return this.giftOrdersService.claimGift(req.user.id, id, dto);
  }

  @Post(':id/resend-invite')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Resend WhatsApp invite' })
  async resendInvite(@Request() req: any, @Param('id') id: string) {
    return this.giftOrdersService.resendInvite(req.user.id, id);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cancel a gift' })
  async cancelGift(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto?: CancelGiftDto,
  ) {
    return this.giftOrdersService.cancelGift(req.user.id, id, dto);
  }

  @Get('admin/refund-requests')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List gift refund requests for admin review' })
  async listRefundRequests(@Query() query: ListGiftRefundRequestsDto) {
    return this.giftOrdersService.listRefundRequests(query);
  }

  @Post('admin/:id/refund-approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve gift refund request and credit wallet' })
  async approveRefundRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewGiftRefundDto,
  ) {
    return this.giftOrdersService.approveRefundRequest(
      req.user.id,
      id,
      dto?.note,
    );
  }

  @Post('admin/:id/refund-reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject gift refund request' })
  async rejectRefundRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewGiftRefundDto,
  ) {
    return this.giftOrdersService.rejectRefundRequest(
      req.user.id,
      id,
      dto?.note,
    );
  }
}
