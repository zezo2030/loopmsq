import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EInvoice } from '../../database/entities/einvoice.entity';
import { ZatcaCredential } from '../../database/entities/zatca-credential.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Booking } from '../../database/entities/booking.entity';
import { OfferBooking } from '../../database/entities/offer-booking.entity';
import { SubscriptionPurchase } from '../../database/entities/subscription-purchase.entity';
import { User } from '../../database/entities/user.entity';
import { InvoicingService } from './invoicing.service';
import { InvoicingController } from './invoicing.controller';
import { InvoiceQueueService, EINVOICE_QUEUE } from './invoice-queue.service';
import { InvoiceProcessor } from './invoice.processor';
import { InvoiceCompositionService } from './invoice-composition.service';
import { EncryptionService } from '../../utils/encryption.util';
import { ZatcaXmlService } from '../../integrations/zatca/zatca-xml.service';
import { ZatcaSignerService } from '../../integrations/zatca/zatca-signer.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      EInvoice,
      ZatcaCredential,
      Payment,
      Booking,
      OfferBooking,
      SubscriptionPurchase,
      User,
    ]),
    BullModule.registerQueue({ name: EINVOICE_QUEUE }),
  ],
  controllers: [InvoicingController],
  providers: [
    InvoicingService,
    InvoiceQueueService,
    InvoiceProcessor,
    InvoiceCompositionService,
    EncryptionService,
    ZatcaXmlService,
    ZatcaSignerService,
  ],
  exports: [InvoicingService, InvoiceQueueService],
})
export class InvoicingModule {}
