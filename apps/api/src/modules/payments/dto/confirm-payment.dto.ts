import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ConfirmPaymentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  eventRequestId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tripRequestId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Offer booking ID' })
  @IsOptional()
  @IsUUID()
  offerBookingId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Subscription purchase ID',
  })
  @IsOptional()
  @IsUUID()
  subscriptionPurchaseId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Gift order ID for gift purchase flow',
  })
  @IsOptional()
  @IsUUID()
  giftOrderId?: string;

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
