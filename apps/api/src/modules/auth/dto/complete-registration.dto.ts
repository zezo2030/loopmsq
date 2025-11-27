import { IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteRegistrationDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+966501234567',
  })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Full name of the user', example: 'Ahmed Ali' })
  @IsString()
  name: string;

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


















