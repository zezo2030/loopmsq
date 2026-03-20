import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

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

  @ApiProperty({
    description: 'Internal payment id or external gateway payment id',
  })
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  gatewayPayload?: Record<string, any>;
}
