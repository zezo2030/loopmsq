import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { OfferBooking } from '../../database/entities/offer-booking.entity';
import { OfferTicket } from '../../database/entities/offer-ticket.entity';
import { OfferProduct } from '../../database/entities/offer-product.entity';
import { Payment } from '../../database/entities/payment.entity';
import { OfferBookingsController } from './offer-bookings.controller';
import { OfferBookingsService } from './offer-bookings.service';
import { QRCodeService } from '../../utils/qr-code.service';
import { OfferTicketExpiryProcessor } from './offer-ticket-expiry.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../../database/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OfferBooking,
      OfferTicket,
      OfferProduct,
      Payment,
      User,
    ]),
    BullModule.registerQueue({ name: 'offer_ticket_expiry' }),
    NotificationsModule,
  ],
  controllers: [OfferBookingsController],
  providers: [OfferBookingsService, QRCodeService, OfferTicketExpiryProcessor],
  exports: [OfferBookingsService],
})
export class OfferBookingsModule {}
