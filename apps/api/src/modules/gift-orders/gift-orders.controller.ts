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
import { GiftQuoteDto } from './dto/gift-quote.dto';
import { CreateGiftOrderDto } from './dto/create-gift-order.dto';
import { ClaimGiftDto } from './dto/claim-gift.dto';
import { ListGiftOrdersDto } from './dto/list-gift-orders.dto';
import { CancelGiftDto } from './dto/cancel-gift.dto';

@ApiTags('gift-orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('gift-orders')
export class GiftOrdersController {
  constructor(private readonly giftOrdersService: GiftOrdersService) {}

  @Post('quote')
  @ApiOperation({ summary: 'Get gift pricing quote' })
  async getQuote(@Request() req: any, @Body() dto: GiftQuoteDto) {
    return this.giftOrdersService.getQuote(req.user.id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a gift order' })
  async createGiftOrder(@Request() req: any, @Body() dto: CreateGiftOrderDto) {
    return this.giftOrdersService.createGiftOrder(req.user.id, dto);
  }

  @Get('me/sent')
  @ApiOperation({ summary: 'Get sent gifts' })
  async getSentGifts(@Request() req: any, @Query() query: ListGiftOrdersDto) {
    return this.giftOrdersService.getSentGifts(req.user.id, query);
  }

  @Get('me/received')
  @ApiOperation({ summary: 'Get received gifts' })
  async getReceivedGifts(
    @Request() req: any,
    @Query() query: ListGiftOrdersDto,
  ) {
    return this.giftOrdersService.getReceivedGifts(req.user.id, query);
  }

  @Get('by-token/:token')
  @ApiOperation({ summary: 'Resolve claim token to gift metadata' })
  async resolveClaimToken(@Request() req: any, @Param('token') token: string) {
    return this.giftOrdersService.resolveClaimToken(req.user.id, token);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get gift details' })
  async getGiftDetails(@Request() req: any, @Param('id') id: string) {
    return this.giftOrdersService.getGiftDetails(req.user.id, id);
  }

  @Post(':id/claim')
  @ApiOperation({ summary: 'Claim a gift' })
  async claimGift(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ClaimGiftDto,
  ) {
    return this.giftOrdersService.claimGift(req.user.id, id, dto);
  }

  @Post(':id/resend-invite')
  @ApiOperation({ summary: 'Resend WhatsApp invite' })
  async resendInvite(@Request() req: any, @Param('id') id: string) {
    return this.giftOrdersService.resendInvite(req.user.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a gift' })
  async cancelGift(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto?: CancelGiftDto,
  ) {
    return this.giftOrdersService.cancelGift(req.user.id, id, dto);
  }
}
