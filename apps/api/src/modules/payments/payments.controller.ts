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

  @Get('success')
  @ApiOperation({ summary: 'Payment success page' })
  async handleSuccess(@Query('paymentId') paymentId: string) {
    // Return simple HTML with deep link
    // Use intent:// scheme for Android and loopmsq:// for iOS
    const deepLinkUrl = `loopmsq://payment/success?id=${paymentId}`;
    const intentUrl = `intent://payment/success?id=${paymentId}#Intent;scheme=loopmsq;package=com.company.kinetic;end`;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Successful</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              text-align: center; 
              padding: 40px 20px; 
              background-color: #f9f9f9; 
              margin: 0;
            }
            .card { 
              background: white; 
              padding: 40px; 
              border-radius: 12px; 
              box-shadow: 0 4px 12px rgba(0,0,0,0.05); 
              max-width: 400px; 
              margin: 0 auto; 
            }
            .icon { font-size: 60px; margin-bottom: 20px; }
            h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
            p { color: #666; margin-bottom: 30px; line-height: 1.5; }
            .btn { 
              display: inline-block; 
              padding: 12px 24px; 
              background: #4CAF50; 
              color: white; 
              text-decoration: none; 
              border-radius: 6px; 
              font-weight: bold; 
              transition: background 0.2s;
              cursor: pointer;
            }
            .btn:hover { background: #45a049; }
            .loading { 
              display: none; 
              margin-top: 20px; 
              color: #666; 
              font-size: 14px; 
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✅</div>
            <h1>Payment Successful!</h1>
            <p>Your payment has been processed successfully.<br>Redirecting to the application...</p>
            <div class="loading" id="loading">If you are not redirected automatically, click the button below.</div>
            <a href="${deepLinkUrl}" id="deepLinkBtn" class="btn" style="display: none;">Return to App</a>
          </div>
          <script>
            (function() {
              var userAgent = navigator.userAgent || navigator.vendor || window.opera;
              var isAndroid = /android/i.test(userAgent);
              var isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
              
              var deepLinkUrl = "${deepLinkUrl}";
              var intentUrl = "${intentUrl}";
              
              var redirectAttempted = false;
              
              // Show loading message and button after 1 second
              setTimeout(function() {
                document.getElementById('loading').style.display = 'block';
                document.getElementById('deepLinkBtn').style.display = 'inline-block';
              }, 1000);
              
              // Function to redirect to app
              function redirectToApp() {
                if (redirectAttempted) return;
                redirectAttempted = true;
                
                try {
                  if (isAndroid) {
                    // For Android, use intent:// scheme first
                    console.log('Attempting Android intent redirect:', intentUrl);
                    window.location.href = intentUrl;
                    
                    // Fallback: try custom scheme after 300ms
                    setTimeout(function() {
                      console.log('Fallback: trying custom scheme:', deepLinkUrl);
                      window.location.href = deepLinkUrl;
                    }, 300);
                  } else if (isIOS) {
                    // For iOS, use custom scheme
                    console.log('Attempting iOS deep link:', deepLinkUrl);
                    window.location.href = deepLinkUrl;
                  } else {
                    // For other platforms, try custom scheme
                    console.log('Attempting deep link:', deepLinkUrl);
                    window.location.href = deepLinkUrl;
                  }
                } catch (e) {
                  console.error('Error redirecting:', e);
                  document.getElementById('loading').style.display = 'block';
                  document.getElementById('deepLinkBtn').style.display = 'inline-block';
                }
              }
              
              // Try redirect immediately on page load
              if (document.readyState === 'complete' || document.readyState === 'interactive') {
                setTimeout(redirectToApp, 100);
              } else {
                window.addEventListener('load', function() {
                  setTimeout(redirectToApp, 100);
                });
              }
              
              // Also try on DOMContentLoaded
              document.addEventListener('DOMContentLoaded', function() {
                setTimeout(redirectToApp, 200);
              });
              
              // Manual button click handler
              document.getElementById('deepLinkBtn').addEventListener('click', function(e) {
                e.preventDefault();
                redirectToApp();
              });
            })();
          </script>
        </body>
      </html>
    `;
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


