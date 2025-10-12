import {
  IsUUID,
  IsDateString,
  IsInt,
  IsOptional,
  IsArray,
  IsString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class QuoteAddOnDto {
  @ApiProperty({
    description: 'Add-on ID',
    example: 'addon-uuid',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Quantity',
    example: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class BookingQuoteDto {
  @ApiProperty({
    description: 'Branch ID',
    example: 'branch-uuid',
  })
  @IsUUID()
  branchId: string;

  @ApiProperty({
    description: 'Hall ID (optional)',
    example: 'hall-uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  hallId?: string;

  @ApiProperty({
    description: 'Booking start time',
    example: '2024-01-15T14:00:00.000Z',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description: 'Duration in hours',
    example: 3,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  durationHours: number;

  @ApiProperty({
    description: 'Number of persons',
    example: 50,
  })
  @IsInt()
  @Min(1)
  persons: number;

  @ApiProperty({
    description: 'Add-ons for the booking',
    type: [QuoteAddOnDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteAddOnDto)
  addOns?: QuoteAddOnDto[];

  @ApiProperty({
    description: 'Coupon code for discount',
    example: 'SAVE20',
    required: false,
  })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
