import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionQuoteDto {
  @ApiProperty({
    description: 'Subscription plan ID',
    example: 'plan-uuid',
  })
  @IsUUID()
  subscriptionPlanId: string;

  @ApiProperty({
    description: 'Optional discount coupon code',
    example: 'SAVE20',
    required: false,
  })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
