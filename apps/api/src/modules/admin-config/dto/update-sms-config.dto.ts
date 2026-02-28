import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSmsConfigDto {
  @ApiProperty({
    description: 'Enable/disable WhatsApp OTP sending',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    description: 'Messaging provider',
    enum: ['whatsapp'],
    required: false,
  })
  @IsOptional()
  @IsIn(['whatsapp'])
  provider?: 'whatsapp';

  @ApiProperty({
    description: 'WhatsApp Cloud API access token',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  whatsappAccessToken?: string;

  @ApiProperty({
    description: 'WhatsApp Business phone number ID',
    required: false,
    example: '123456789012345',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  whatsappPhoneNumberId?: string;
}


