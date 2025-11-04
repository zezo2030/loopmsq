import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterSendOtpDto {
  @ApiProperty({ description: 'Full name of the user', example: 'Ahmed Ali' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  email: string;

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
