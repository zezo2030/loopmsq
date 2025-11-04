import { IsString, Length, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'OTP code received via email',
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
