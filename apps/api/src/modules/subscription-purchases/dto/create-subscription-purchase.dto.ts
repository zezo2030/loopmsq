import { IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionPurchaseDto {
  @ApiProperty({
    description: 'Subscription plan ID',
    example: 'plan-uuid',
  })
  @IsUUID()
  subscriptionPlanId: string;

  @ApiProperty({
    description:
      'Whether the user accepted the subscription terms and conditions',
    example: true,
  })
  @IsBoolean()
  acceptedTerms: boolean;
}
