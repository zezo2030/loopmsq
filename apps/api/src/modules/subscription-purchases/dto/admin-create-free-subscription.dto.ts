import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminCreateFreeSubscriptionDto {
  @ApiProperty({
    description: 'Target user (customer) the free subscription is granted to',
    example: 'user-uuid',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Subscription plan ID',
    example: 'plan-uuid',
  })
  @IsUUID()
  subscriptionPlanId: string;

  @ApiProperty({
    description: 'Child/subscription holder display name',
    example: 'Omar Ahmed',
  })
  @IsString()
  @Length(2, 100)
  holderName: string;

  @ApiProperty({
    description: 'Optional uploaded image URL for the subscription holder',
    example: 'https://res.cloudinary.com/demo/image/upload/holder-photo.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  holderImageUrl?: string;

  @ApiProperty({
    description: 'Optional internal note explaining why the grant was issued',
    example: 'Compensation for service outage',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}
