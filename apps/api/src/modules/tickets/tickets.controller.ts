import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ShareTicketDto } from './dto/share-ticket.dto';
import { GiftTicketDto } from './dto/gift-ticket.dto';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get(':id/qr')
  @ApiOperation({ summary: 'Get ticket QR (signed URL or data URL)' })
  @ApiResponse({ status: 200, description: 'QR generated' })
  async getTicketQR(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ticketsService.getTicketQR(user.id, id);
  }

  @Get(':id/share')
  @ApiOperation({ summary: 'Get share link payload for a ticket' })
  async getShareLink(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ticketsService.getShareLink(user.id, id);
  }

  @Post(':id/gift')
  @ApiOperation({ summary: 'Gift ticket to another holder' })
  async giftTicket(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GiftTicketDto,
  ) {
    return this.ticketsService.giftTicket(user.id, id, dto);
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Create/refresh a signed share token' })
  async createShareToken(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareTicketDto,
  ) {
    return this.ticketsService.createShareToken(user.id, id, dto);
  }
}


