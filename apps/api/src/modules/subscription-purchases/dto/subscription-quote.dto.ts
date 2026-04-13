import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionQuoteDto {
  @ApiProperty({
    description: 'Subscription plan ID',
    example: 'plan-uuid',
  })
  @IsUUID()
  subscriptionPlanId: string;
}
