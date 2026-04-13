import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../../database/entities/payment.entity';
import { Type } from 'class-transformer';

class PaymentOfferAddOnDto {
  @ApiProperty({
    description: 'Add-on identifier from the offer definition',
    example: 'Meal',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreatePaymentIntentDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  eventRequestId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'School trip request ID for payment',
  })
  @IsOptional()
  @IsUUID()
  tripRequestId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Offer booking ID for payment',
  })
  @IsOptional()
  @IsUUID()
  offerBookingId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Subscription purchase ID for payment',
  })
  @IsOptional()
  @IsUUID()
  subscriptionPurchaseId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Offer product ID for pay-first offer purchase flow',
  })
  @IsOptional()
  @IsUUID()
  offerProductId?: string;

  @ApiPropertyOptional({
    description: 'Selected add-ons for pay-first offer purchase flow',
    type: [PaymentOfferAddOnDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentOfferAddOnDto)
  addOns?: PaymentOfferAddOnDto[];

  @ApiPropertyOptional({
    description: 'Contact phone number for pay-first offer purchase flow',
  })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Subscription plan ID for pay-first subscription flow',
  })
  @IsOptional()
  @IsUUID()
  subscriptionPlanId?: string;

  @ApiPropertyOptional({
    description: 'Whether the user accepted the relevant terms',
  })
  @IsOptional()
  @IsBoolean()
  acceptedTerms?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Gift order ID for gift purchase flow',
  })
  @IsOptional()
  @IsUUID()
  giftOrderId?: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
