import { IsPhoneNumber, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterVerifyOtpDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+966501234567',
  })
  @IsPhoneNumber()
  phone: string;

  @ApiProperty({ description: 'OTP code received via SMS', example: '123456' })
  @IsString()
  @Length(4, 6)
  otp: string;
}
