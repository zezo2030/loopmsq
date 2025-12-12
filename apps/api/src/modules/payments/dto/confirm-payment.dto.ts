import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsObject, ValidateIf } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o) => !o.eventRequestId)
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((o) => !o.bookingId)
  @IsUUID()
  eventRequestId?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paymentId: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  gatewayPayload?: Record<string, any>;
}


