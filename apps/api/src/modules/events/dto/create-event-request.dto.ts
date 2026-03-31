import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddOnDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

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
      'Event calendar date. Time part is ignored and normalized to start of the selected day.',
    example: '2026-04-15',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description:
      'Ticket validity duration in hours starting from the beginning of the selected event day.',
    example: 6,
  })
  @IsInt()
  @Min(1)
  durationHours: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
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
}
