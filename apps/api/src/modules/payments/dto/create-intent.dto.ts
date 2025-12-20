import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsUUID, ValidateIf } from 'class-validator';
import { PaymentMethod } from '../../../database/entities/payment.entity';

export class CreatePaymentIntentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o) => !o.eventRequestId && !o.tripRequestId)
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o) => !o.bookingId && !o.tripRequestId)
  @IsUUID()
  eventRequestId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'School trip request ID for payment' })
  @ValidateIf((o) => !o.bookingId && !o.eventRequestId)
  @IsUUID()
  tripRequestId?: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}


