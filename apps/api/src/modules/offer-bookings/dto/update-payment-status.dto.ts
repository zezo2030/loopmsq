import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OfferBookingPaymentStatus } from '../../../database/entities/offer-booking.entity';

export class UpdatePaymentStatusDto {
  @ApiProperty({
    description: 'New payment status to set manually (admin)',
    enum: OfferBookingPaymentStatus,
    example: OfferBookingPaymentStatus.COMPLETED,
  })
  @IsEnum(OfferBookingPaymentStatus)
  paymentStatus: OfferBookingPaymentStatus;
}
