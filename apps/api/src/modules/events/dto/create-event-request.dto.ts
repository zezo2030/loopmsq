import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
  IsUUID,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../../database/entities/payment.entity';

class AddOnDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateEventRequestDto {
  @ApiProperty()
  @IsString()
  @Length(2, 50)
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  decorated?: boolean;

  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty({
    description:
      'Event calendar date (YYYY-MM-DD). ISO datetime accepted and normalized.',
    example: '2026-04-15',
  })
  @IsString()
  @Length(10, 40)
  startTime: string;

  @ApiProperty({
    description: 'Fixed 2-hour private event slot duration',
    example: 2,
  })
  @IsInt()
  @Min(1)
  @Max(2)
  durationHours: number;

  @ApiProperty({
    description: 'Selected fixed time slot',
    enum: ['16:00-18:00', '19:00-21:00', '22:00-00:00'],
  })
  @IsString()
  @IsIn(['16:00-18:00', '19:00-21:00', '22:00-00:00'])
  selectedTimeSlot: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(7)
  persons: number;

  @ApiPropertyOptional({ type: [AddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOnDto)
  addOns?: AddOnDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @ApiProperty()
  @IsBoolean()
  acceptedTerms: boolean;

  @ApiProperty({ enum: ['full', 'deposit'], example: 'full' })
  @IsString()
  @IsIn(['full', 'deposit'])
  paymentOption: 'full' | 'deposit';

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  paymentMethod?: PaymentMethod;
}
