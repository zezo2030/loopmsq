import {
  IsString,
  IsInt,
  IsOptional,
  IsObject,
  IsArray,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @IsPhoneNumber()
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
}
