import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../../database/entities/payment.entity';

class AddOnDto {
  @ApiProperty({ description: 'Add-on ID', example: 'addon-uuid' })
  @IsString()
  id: string;

  @ApiPropertyOptional({ description: 'Add-on name', example: 'Meals' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Add-on price', example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateTripRequestDto {
  @ApiProperty({ description: 'Branch ID', example: 'branch-uuid' })
  @IsUUID()
  branchId: string;

  @ApiProperty()
  @IsString()
  @Length(2, 200)
  schoolName: string;

  @ApiPropertyOptional({
    description: 'Students count',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  studentsCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  accompanyingAdults?: number;

  @ApiProperty()
  @IsDateString()
  preferredDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 50)
  preferredTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  durationHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  specialRequirements?: string;

  @ApiPropertyOptional({ description: 'Add-ons (meals, drinks)', type: Array })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOnDto)
  addOns?: AddOnDto[];

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiProperty({
    description: 'Payment option for school trip booking',
    enum: ['full', 'deposit'],
    example: 'deposit',
  })
  @IsString()
  @Length(4, 20)
  paymentOption: string;
}
