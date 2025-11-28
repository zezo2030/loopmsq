import {
  IsString,
  IsInt,
  IsOptional,
  IsObject,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
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

export class CreateBranchDto {
  @ApiProperty({
    description: 'Branch name in Arabic',
    example: 'فرع الرياض الرئيسي',
  })
  @IsString()
  name_ar: string;

  @ApiProperty({
    description: 'Branch name in English',
    example: 'Riyadh Main Branch',
  })
  @IsString()
  name_en: string;

  @ApiProperty({
    description: 'Branch location/address',
    example: 'King Fahd Road, Riyadh, Saudi Arabia',
  })
  @IsString()
  location: string;

  @ApiProperty({
    description: 'Total branch capacity',
    example: 500,
  })
  @IsInt()
  capacity: number;

  @ApiProperty({
    description: 'Branch description in Arabic',
    example: 'فرع حديث ومجهز بأحدث التقنيات',
    required: false,
  })
  @IsOptional()
  @IsString()
  description_ar?: string;

  @ApiProperty({
    description: 'Branch description in English',
    example: 'Modern branch equipped with latest technology',
    required: false,
  })
  @IsOptional()
  @IsString()
  description_en?: string;

  @ApiProperty({
    description: 'Contact phone number',
    example: '+966112345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({
    description: 'Working hours for each day',
    example: {
      sunday: { open: '09:00', close: '22:00' },
      monday: { open: '09:00', close: '22:00' },
      friday: { closed: true },
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  workingHours?: {
    [key: string]: { open: string; close: string; closed?: boolean };
  };

  @ApiProperty({
    description: 'List of amenities available',
    example: ['WiFi', 'Parking', 'Food Court', 'Prayer Room'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  amenities?: string[];

  @ApiProperty({
    description: 'Branch status',
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active',
    required: false,
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'maintenance'])
  status?: 'active' | 'inactive' | 'maintenance';

  @ApiProperty({
    description: 'Branch latitude coordinate',
    example: 24.7136,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({
    description: 'Branch longitude coordinate',
    example: 46.6753,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({
    description: 'YouTube video URL for the branch',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    required: false,
  })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  // Hall fields (optional - hall will be created automatically with defaults if not provided)
  @ApiProperty({
    description: 'Hall name in Arabic',
    example: 'قاعة الاحتفالات',
    required: false,
  })
  @IsOptional()
  @IsString()
  hallName_ar?: string;

  @ApiProperty({
    description: 'Hall name in English',
    example: 'Celebration Hall',
    required: false,
  })
  @IsOptional()
  @IsString()
  hallName_en?: string;

  @ApiProperty({
    description: 'Hall pricing configuration',
    type: PriceConfigDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceConfigDto)
  hallPriceConfig?: PriceConfigDto;

  @ApiProperty({
    description: 'Hall capacity (number of people)',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsInt()
  hallCapacity?: number;

  @ApiProperty({
    description: 'Whether the hall comes with decoration',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  hallIsDecorated?: boolean;

  @ApiProperty({
    description: 'Hall description in Arabic',
    example: 'قاعة فسيحة ومجهزة بأحدث التقنيات',
    required: false,
  })
  @IsOptional()
  @IsString()
  hallDescription_ar?: string;

  @ApiProperty({
    description: 'Hall description in English',
    example: 'Spacious hall equipped with latest technology',
    required: false,
  })
  @IsOptional()
  @IsString()
  hallDescription_en?: string;

  @ApiProperty({
    description: 'List of hall features',
    example: ['Sound System', 'Projector', 'Air Conditioning', 'Stage'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  hallFeatures?: string[];

  @ApiProperty({
    description: 'List of hall image URLs',
    example: ['https://example.com/hall1.jpg'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  hallImages?: string[];

  @ApiProperty({
    description: 'YouTube video URL for the hall',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    required: false,
  })
  @IsOptional()
  @IsString()
  hallVideoUrl?: string;
}
