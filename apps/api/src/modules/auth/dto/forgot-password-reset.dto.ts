import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordResetDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+966501234567',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'OTP code received via WhatsApp',
    example: '123456',
  })
  @IsString()
  otp: string;

  @ApiProperty({
    description: 'New password',
    example: 'StrongPass#2025',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}
