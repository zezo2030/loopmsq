import {
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsString,
  IsBoolean,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class BookingAddOnDto {
  @ApiProperty({
    description: 'Add-on identifier from the offer definition',
    example: 'Meal',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOfferBookingDto {
  @ApiProperty({ description: 'Offer product ID', example: 'offer-uuid' })
  @IsUUID()
  offerProductId: string;

  @ApiProperty({
    description: 'Number of offer copies to purchase',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity?: number;

  @ApiProperty({
    description: 'Selected add-ons with quantities',
    type: [BookingAddOnDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingAddOnDto)
  addOns?: BookingAddOnDto[];

  @ApiProperty({
    description: 'Contact phone number',
    example: '+966501234567',
    required: false,
  })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({
    description: 'Whether the user accepted the offer terms and conditions',
    example: true,
  })
  @IsBoolean()
  acceptedTerms: boolean;

  @ApiProperty({
    description: 'Optional discount coupon code',
    example: 'SAVE20',
    required: false,
  })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
