import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, IsUUID } from 'class-validator';

export class CreateCouponDto {
  @IsUUID()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsEnum(['percentage', 'fixed'])
  discountType: 'percentage' | 'fixed';

  @IsNumber()
  discountValue: number;

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


