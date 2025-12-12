import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../../database/entities/payment.entity';

class AddOnDto {
  @ApiProperty({ description: 'Add-on ID', example: 'addon-uuid' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Add-on name', example: 'Meals' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Add-on price', example: 20 })
  @IsInt()
  @Min(0)
  price: number;

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

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(10000)
  studentsCount: number;

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
  @Length(1, 10)
  preferredTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  durationHours?: number;

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  contactPersonName: string;

  @ApiProperty()
  @IsString()
  @Length(5, 20)
  contactPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

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
}


