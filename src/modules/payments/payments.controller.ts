import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
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

@ApiTags('payments')
@Controller('payments')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @ApiOperation({ summary: 'Create payment intent for booking' })
  @ApiResponse({ status: 201, description: 'Payment intent created' })
  async createIntent(
    @CurrentUser() user: User,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.paymentsService.createIntent(user.id, dto);
  }

  @Post('confirm')
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
  @UseGuards()
  @ApiOperation({ summary: 'Payment gateway webhook (no auth)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(@Body() dto: WebhookEventDto) {
    return this.paymentsService.handleWebhook(dto);
  }

  @Post('refund')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Refund a payment (Admin only)' })
  @ApiResponse({ status: 200, description: 'Refund processed' })
  async refundPayment(@Body() dto: RefundDto) {
    return this.paymentsService.refundPayment(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  async getPaymentById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.getPaymentById(user.id, id);
  }
}


