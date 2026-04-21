import {
  IsUUID,
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  SubscriptionDurationType,
  SubscriptionUsageMode,
} from '../../../database/entities/subscription-plan.entity';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ description: 'Branch ID', example: 'branch-uuid' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'Plan title', example: 'Monthly Pass' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Plan description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Cover image URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Terms and conditions shown before purchase',
    required: false,
  })
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @ApiProperty({ description: 'Price in SAR', example: 500.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'SAR',
    required: false,
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Total hours in the plan',
    example: 20.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  totalHours?: number;

  @ApiProperty({
    description: 'Max hours deductible per day',
    example: 2.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  dailyHoursLimit?: number;

  @ApiProperty({
    description: 'Usage mode',
    enum: SubscriptionUsageMode,
    example: SubscriptionUsageMode.FLEXIBLE_TOTAL_HOURS,
  })
  @IsEnum(SubscriptionUsageMode)
  usageMode: SubscriptionUsageMode;

  @ApiProperty({
    description: 'Duration type',
    enum: SubscriptionDurationType,
    example: SubscriptionDurationType.MONTHLY,
  })
  @IsEnum(SubscriptionDurationType)
  durationType: SubscriptionDurationType;

  @ApiProperty({
    description: 'Duration in months',
    example: 1,
  })
  @IsInt()
  @Min(1)
  durationMonths: number;

  @ApiProperty({
    description: 'Availability window start',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({
    description: 'Availability window end',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiProperty({
    description: 'Meals included in the subscription',
    required: false,
    example: ['بيتزا', 'عصير'],
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  mealItems?: string[];

  @ApiProperty({
    description: 'Whether the subscription plan can be sent as a gift',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isGiftable?: boolean;
}
