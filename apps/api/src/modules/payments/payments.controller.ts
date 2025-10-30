import {
  Body,
  Controller,
  Get,
  Query,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../../database/entities/user.entity';
import { CreatePaymentIntentDto } from './dto/create-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { RefundDto } from './dto/refund.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { TapService } from '../../integrations/tap/tap.service';
import type { Request } from 'express';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly tapService: TapService,
  ) {}

  @Post('intent')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment intent for booking' })
  @ApiResponse({ status: 201, description: 'Payment intent created' })
  async createIntent(
    @CurrentUser() user: User,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.paymentsService.createIntent(user.id, dto);
  }

  @Post('confirm')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm payment' })
  @ApiResponse({ status: 200, description: 'Payment confirmed' })
  async confirmPayment(
    @CurrentUser() user: User,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.paymentsService.confirmPayment(user.id, dto);
  }

  // Webhook - no auth
  @Post('webhook')
  @ApiOperation({ summary: 'Payment gateway webhook (no auth)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(@Body() dto: WebhookEventDto, @Req() req: Request) {
    const signature = (req.headers['tap-signature'] || req.headers['x-tap-signature']) as string | undefined;
    const rawBody: any = (req as any).body;
    const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : JSON.stringify(dto || {});
    const ok = this.tapService.verifyWebhookSignature(raw, signature);
    if (!ok) throw new UnauthorizedException('Invalid webhook signature');
    return this.paymentsService.handleWebhook(dto);
  }

  @Post('refund')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Refund a payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Refund processed' })
  async refundPayment(@Body() dto: RefundDto) {
    return this.paymentsService.refundPayment(dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List payments (Admin only)' })
  async listPayments(@Query() query: ListPaymentsDto) {
    return this.paymentsService.listPaymentsAdmin(query);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID' })
  async getPaymentById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.getPaymentById(user.id, id);
  }

  @Get('admin/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID (Admin only)' })
  async getPaymentByIdAdmin(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.getPaymentByIdAdmin(id);
  }
}


