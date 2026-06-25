import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPurchasePaymentStatus } from '../../../database/entities/subscription-purchase.entity';

export class UpdatePaymentStatusDto {
  @ApiProperty({
    description: 'New payment status to set manually (admin)',
    enum: SubscriptionPurchasePaymentStatus,
    example: SubscriptionPurchasePaymentStatus.COMPLETED,
  })
  @IsEnum(SubscriptionPurchasePaymentStatus)
  paymentStatus: SubscriptionPurchasePaymentStatus;
}
