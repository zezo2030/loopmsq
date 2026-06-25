import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
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

  @ApiProperty({
    description: 'Child/subscription holder display name',
    example: 'Omar Ahmed',
  })
  @IsString()
  @Length(2, 100)
  holderName: string;

  @ApiProperty({
    description: 'Uploaded image URL for the subscription holder',
    example: 'https://res.cloudinary.com/demo/image/upload/holder-photo.jpg',
  })
  @IsString()
  holderImageUrl: string;

  @ApiProperty({
    description: 'Optional discount coupon code',
    example: 'SAVE20',
    required: false,
  })
  @IsOptional()
  @IsString()
  couponCode?: string;
}

/**
 * Service input; HTTP clients must still send {@link CreateSubscriptionPurchaseDto.holderImageUrl}
 * (class-validator on the controller DTO).
 */
export type CreateSubscriptionPurchasePayload = Pick<
  CreateSubscriptionPurchaseDto,
  'subscriptionPlanId' | 'acceptedTerms' | 'couponCode'
> &
  Partial<Pick<CreateSubscriptionPurchaseDto, 'holderImageUrl' | 'holderName'>>;

export type CreateSubscriptionPurchaseOptions = {
  /**
   * Internal flows (e.g. gift claim) may omit holder photo; staff sees the no-photo warning.
   */
  allowMissingHolderImage?: boolean;
  /**
   * Force a zero-price purchase regardless of plan price/coupons (admin free grant).
   * The purchase is activated immediately and stays neutral to loyalty accounting
   * (neither counts as a paid purchase nor consumes a loyalty reward).
   */
  forceFree?: boolean;
  /**
   * Admin user id that granted a {@link forceFree} subscription (audit only).
   */
  grantedByAdminId?: string;
  /**
   * Optional note attached to a {@link forceFree} grant (audit only).
   */
  grantNote?: string;
};
