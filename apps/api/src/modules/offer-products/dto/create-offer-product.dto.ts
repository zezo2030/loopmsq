import {
  IsUUID,
  IsString,
  IsInt,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OfferCategory } from '../../../database/entities/offer-product.entity';

class TicketConfigDto {
  @ApiProperty({ description: 'Number of paid tickets', example: 2 })
  @IsInt()
  @Min(1)
  paidTicketCount: number;

  @ApiProperty({ description: 'Number of free tickets', example: 1 })
  @IsInt()
  @Min(0)
  freeTicketCount: number;
}

class HoursConfigDto {
  @ApiProperty({ description: 'Duration in hours', example: 3.0 })
  @IsNumber()
  @Min(0.5)
  durationHours: number;

  @ApiProperty({
    description: 'Free bonus hours included in the offer',
    example: 1.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusHours?: number;

  @ApiProperty({
    description: 'Whether the offer is open time (play until tired)',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isOpenTime?: boolean;
}

class IncludedAddOnDto {
  @ApiProperty({ description: 'Add-on catalog ID', example: 'addon-uuid' })
  @IsUUID()
  addonId: string;

  @ApiProperty({ description: 'Quantity included', example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOfferProductDto {
  @ApiProperty({ description: 'Branch ID', example: 'branch-uuid' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'Offer title', example: 'Family Package' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Offer description',
    example: 'Enjoy with the whole family',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Cover image URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Terms and conditions shown before purchase',
    required: false,
  })
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @ApiProperty({
    description: 'Offer category',
    enum: OfferCategory,
    example: OfferCategory.TICKET_BASED,
  })
  @IsEnum(OfferCategory)
  offerCategory: OfferCategory;

  @ApiProperty({ description: 'Price in SAR', example: 150.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'SAR',
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Whether user can re-purchase immediately',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  canRepeatInSameOrder?: boolean;

  @ApiProperty({
    description: 'Whether the offer can be sent as a gift',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isGiftable?: boolean;

  @ApiProperty({
    description: 'Included add-ons (gifts/meals)',
    type: [IncludedAddOnDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncludedAddOnDto)
  includedAddOns?: IncludedAddOnDto[];

  @ApiProperty({
    description: 'Ticket config (required for ticket_based)',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TicketConfigDto)
  ticketConfig?: TicketConfigDto;

  @ApiProperty({
    description: 'Hours config (required for hour_based)',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => HoursConfigDto)
  hoursConfig?: HoursConfigDto;

  @ApiProperty({
    description: 'Availability window start',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({
    description: 'Availability window end',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
