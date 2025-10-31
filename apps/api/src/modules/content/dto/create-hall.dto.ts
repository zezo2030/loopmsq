import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsObject,
  IsArray,
  IsUUID,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class PriceConfigDto {
  @ApiProperty({ description: 'Base price for the hall', example: 500 })
  @IsNumber()
  basePrice: number;

  @ApiProperty({ description: 'Hourly rate', example: 100 })
  @IsNumber()
  hourlyRate: number;

  @ApiProperty({ description: 'Price per person', example: 10, required: false })
  @IsOptional()
  @IsNumber()
  pricePerPerson?: number;

  @ApiProperty({ description: 'Weekend multiplier', example: 1.5 })
  @IsNumber()
  weekendMultiplier: number;

  @ApiProperty({ description: 'Holiday multiplier', example: 2.0 })
  @IsNumber()
  holidayMultiplier: number;

  @ApiProperty({ description: 'Decoration price', example: 200, required: false })
  @IsOptional()
  @IsNumber()
  decorationPrice?: number;
}

export class CreateHallDto {
  @ApiProperty({
    description: 'Branch ID where the hall belongs',
    example: 'uuid-string',
  })
  @IsUUID()
  branchId: string;

  @ApiProperty({
    description: 'Hall name in Arabic',
    example: 'قاعة الاحتفالات الكبرى',
  })
  @IsString()
  name_ar: string;

  @ApiProperty({
    description: 'Hall name in English',
    example: 'Grand Celebration Hall',
  })
  @IsString()
  name_en: string;

  @ApiProperty({
    description: 'Hall pricing configuration',
    type: PriceConfigDto,
  })
  @ValidateNested()
  @Type(() => PriceConfigDto)
  priceConfig: PriceConfigDto;

  @ApiProperty({
    description: 'Whether the hall comes with decoration',
    example: false,
  })
  @IsBoolean()
  isDecorated: boolean;

  @ApiProperty({
    description: 'Hall capacity (number of people)',
    example: 100,
  })
  @IsInt()
  capacity: number;

  @ApiProperty({
    description: 'Hall description in Arabic',
    example: 'قاعة فسيحة ومجهزة بأحدث التقنيات',
    required: false,
  })
  @IsOptional()
  @IsString()
  description_ar?: string;

  @ApiProperty({
    description: 'Hall description in English',
    example: 'Spacious hall equipped with latest technology',
    required: false,
  })
  @IsOptional()
  @IsString()
  description_en?: string;

  @ApiProperty({
    description: 'List of hall features',
    example: ['Sound System', 'Projector', 'Air Conditioning', 'Stage'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  features?: string[];

  @ApiProperty({
    description: 'List of hall image URLs',
    example: ['https://example.com/hall1.jpg', 'https://example.com/hall2.jpg'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  images?: string[];
}
