import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { InvoicingService } from './invoicing.service';
import { InvoiceQueueService } from './invoice-queue.service';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { OnboardDto } from './dto/onboard.dto';

@ApiTags('invoicing')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('admin/invoicing')
export class InvoicingController {
  constructor(
    private readonly service: InvoicingService,
    private readonly queue: InvoiceQueueService,
  ) {}

  @Post('onboard')
  @ApiOperation({
    summary: 'Run ZATCA onboarding (key+CSR -> compliance CSID -> production CSID)',
  })
  async onboard(@Body() dto: OnboardDto) {
    return this.service.onboard(dto);
  }

  @Get('onboarding-status')
  @ApiOperation({ summary: 'Check whether the current environment is onboarded' })
  async onboardingStatus() {
    return this.service.onboardingStatus();
  }

  @Get('health')
  @ApiOperation({ summary: 'Verify the ZATCA toolchain (java + openssl + SDK jar)' })
  async health() {
    return this.service.health();
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Issue (build, sign, clear/report) an e-invoice' })
  async issue(@Body() dto: IssueInvoiceDto) {
    return this.service.issueInvoice(dto);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List issued e-invoices' })
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.list(
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get a single e-invoice' })
  async get(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('payments/:paymentId/issue')
  @ApiOperation({
    summary: 'Queue e-invoice issuance for a completed payment (idempotent)',
  })
  async issueForPayment(@Param('paymentId') paymentId: string) {
    await this.queue.enqueue(paymentId);
    return { queued: true, paymentId };
  }
}
