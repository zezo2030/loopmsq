import {
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsString,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class AddOnSelectionDto {
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

export class OfferQuoteDto {
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
    description: 'Selected add-ons',
    type: [AddOnSelectionDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOnSelectionDto)
  addOns?: AddOnSelectionDto[];

  @ApiProperty({
    description: 'Optional discount coupon code',
    example: 'SAVE20',
    required: false,
  })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
