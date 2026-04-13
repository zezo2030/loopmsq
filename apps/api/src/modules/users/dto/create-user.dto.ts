import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User phone number',
    example: '+966501234567',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'User full name',
    example: 'Ahmed Ali',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'User email address (optional)',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Language preference',
    example: 'ar',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string = 'ar';
}
