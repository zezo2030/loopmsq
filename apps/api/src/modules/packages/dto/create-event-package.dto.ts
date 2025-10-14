import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateEventPackageDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  eventType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsNumber()
  @Min(0)
  pricePerPerson: number;

  @IsNumber()
  @Min(0)
  pricePerHour: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minPersons?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxPersons?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minDuration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDuration?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}


