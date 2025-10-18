import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class UpdateSmsConfigDto {
  @ApiProperty({ description: 'Enable/disable SMS sending', required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    description: 'SMS provider',
    enum: ['twilio'],
    required: false,
  })
  @IsOptional()
  @IsIn(['twilio'])
  provider?: 'twilio';

  @ApiProperty({
    description: 'Twilio Account SID',
    required: false,
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  twilioAccountSid?: string;

  @ApiProperty({
    description: 'Twilio Auth Token',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  twilioAuthToken?: string;

  @ApiProperty({
    description: 'Twilio From Number (E.164)',
    required: false,
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/)
  twilioFromNumber?: string;
}


