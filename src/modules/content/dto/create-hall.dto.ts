import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsObject,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
    example: {
      basePrice: 500,
      hourlyRate: 100,
      weekendMultiplier: 1.5,
      holidayMultiplier: 2.0,
      decorationPrice: 200,
    },
  })
  @IsObject()
  priceConfig: {
    basePrice: number;
    hourlyRate: number;
    weekendMultiplier: number;
    holidayMultiplier: number;
    decorationPrice?: number;
  };

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
