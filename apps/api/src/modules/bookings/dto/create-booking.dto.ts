import {
  IsUUID,
  IsDateString,
  IsInt,
  IsOptional,
  IsArray,
  IsString,
  IsPhoneNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class AddOnDto {
  @ApiProperty({
    description: 'Add-on ID',
    example: 'addon-uuid',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Add-on name',
    example: 'Decoration Package',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Add-on price',
    example: 150.0,
  })
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Quantity',
    example: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateBookingDto {
  @ApiProperty({
    description: 'Branch ID',
    example: 'branch-uuid',
  })
  @IsUUID()
  branchId: string;

  @ApiProperty({
    description: 'Hall ID',
    example: 'hall-uuid',
    required: true,
  })
  @IsUUID()
  hallId: string;

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
    type: [AddOnDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOnDto)
  addOns?: AddOnDto[];

  @ApiProperty({
    description: 'Coupon code for discount',
    example: 'SAVE20',
    required: false,
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiProperty({
    description: 'Special requests or notes',
    example: 'Please arrange tables in U-shape',
    required: false,
  })
  @IsOptional()
  @IsString()
  specialRequests?: string;

  @ApiProperty({
    description: 'Contact phone number',
    example: '+966501234567',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber()
  contactPhone?: string;
}
