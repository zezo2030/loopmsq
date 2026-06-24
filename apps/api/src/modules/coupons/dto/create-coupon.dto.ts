import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateCouponDto {
  @IsUUID()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsEnum(['percentage', 'fixed'])
  discountType: 'percentage' | 'fixed';

  // Lower-bounded here; the upper bound for percentages (<= 100) is enforced
  // server-side in CouponsService against the discountType.
  @IsNumber()
  @Min(0)
  discountValue: number;

  // Optional caps. null/undefined = unlimited. Enforced atomically at redeem().
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  maxDiscountAmount?: number;

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
