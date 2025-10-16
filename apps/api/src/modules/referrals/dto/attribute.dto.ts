import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AttributeReferralDto {
  @ApiProperty({ description: 'Referral code' })
  @IsString()
  code: string;
}


