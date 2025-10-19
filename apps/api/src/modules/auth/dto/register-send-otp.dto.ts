import {
  IsEmail,
  IsPhoneNumber,
  IsString,
  MinLength,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterSendOtpDto {
  @ApiProperty({ description: 'Full name of the user', example: 'Ahmed Ali' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Phone number in international format (optional)',
    example: '+966501234567',
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.phone && o.phone.trim() !== '')
  @IsPhoneNumber('SA', { message: 'Phone must be a valid phone number' })
  phone?: string;

  @ApiProperty({ description: 'Account password', example: 'StrongPass#2025' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Preferred language',
    example: 'ar',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string = 'ar';
}
