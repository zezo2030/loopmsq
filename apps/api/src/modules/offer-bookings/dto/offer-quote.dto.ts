import {
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
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
    description: 'Selected add-ons',
    type: [AddOnSelectionDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOnSelectionDto)
  addOns?: AddOnSelectionDto[];
}
