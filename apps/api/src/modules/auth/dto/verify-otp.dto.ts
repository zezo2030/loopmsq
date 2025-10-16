import { IsPhoneNumber, IsString, Length, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+966501234567',
  })
  @IsPhoneNumber()
  phone: string;

  @ApiProperty({
    description: 'OTP code received via SMS',
    example: '123456',
  })
  @IsString()
  @Length(4, 6)
  otp: string;

  @ApiProperty({
    description: 'User name for registration',
    example: 'Ahmed Ali',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}
