import { IsBoolean, IsString, IsUUID, Length } from 'class-validator';
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
}

/**
 * Service input; HTTP clients must still send {@link CreateSubscriptionPurchaseDto.holderImageUrl}
 * (class-validator on the controller DTO).
 */
export type CreateSubscriptionPurchasePayload = Pick<
  CreateSubscriptionPurchaseDto,
  'subscriptionPlanId' | 'acceptedTerms'
> &
  Partial<Pick<CreateSubscriptionPurchaseDto, 'holderImageUrl' | 'holderName'>>;

export type CreateSubscriptionPurchaseOptions = {
  /**
   * Internal flows (e.g. gift claim) may omit holder photo; staff sees the no-photo warning.
   */
  allowMissingHolderImage?: boolean;
};
