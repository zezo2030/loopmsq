import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateTripRequestDto {
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
  preferredDate: string as unknown as Date;

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
}


