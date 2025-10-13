import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsObject } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  bookingId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paymentId: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  gatewayPayload: Record<string, any>;
}


