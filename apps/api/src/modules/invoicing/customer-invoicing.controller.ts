import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import {
  CUSTOMER_INVOICE_SOURCES,
  CustomerInvoiceSource,
  InvoicingService,
} from './invoicing.service';

/**
 * Customer-facing e-invoice endpoints (JWT only, ownership enforced in the
 * service). Kept separate from InvoicingController which is admin-guarded.
 */
@ApiTags('invoicing')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('invoicing')
export class CustomerInvoicingController {
  constructor(private readonly service: InvoicingService) {}

  @Get('my/:source/:recordId')
  @ApiOperation({
    summary:
      "Get the ZATCA e-invoice for one of the current user's purchases " +
      '(booking | offer-booking | trip | subscription | gift-order | event)',
  })
  @ApiParam({ name: 'source', enum: CUSTOMER_INVOICE_SOURCES })
  async myInvoice(
    @CurrentUser() user: User,
    @Param('source') source: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ) {
    if (!CUSTOMER_INVOICE_SOURCES.includes(source as CustomerInvoiceSource)) {
      throw new BadRequestException(`Unknown invoice source: ${source}`);
    }
    return this.service.findForCustomer(
      user.id,
      source as CustomerInvoiceSource,
      recordId,
    );
  }
}
