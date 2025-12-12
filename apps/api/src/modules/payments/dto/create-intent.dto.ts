import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsUUID, ValidateIf } from 'class-validator';
import { PaymentMethod } from '../../../database/entities/payment.entity';

export class CreatePaymentIntentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o) => !o.eventRequestId)
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o) => !o.bookingId)
  @IsUUID()
  eventRequestId?: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}


