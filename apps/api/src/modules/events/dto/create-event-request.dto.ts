import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Length, Min, ValidateNested, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hallId?: string;

  @ApiProperty()
  @IsDateString()
  startTime: string;

  @ApiProperty()
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


