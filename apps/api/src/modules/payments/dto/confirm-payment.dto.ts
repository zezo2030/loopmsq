import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsObject, ValidateIf } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o) => !o.eventRequestId && !o.tripRequestId)
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o) => !o.bookingId && !o.tripRequestId)
  @IsUUID()
  eventRequestId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o) => !o.bookingId && !o.eventRequestId)
  @IsUUID()
  tripRequestId?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paymentId: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  gatewayPayload?: Record<string, any>;
}


