import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserLoginDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+966501234567',
  })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'Account password', example: 'StrongPass#2025' })
  @IsString()
  @MinLength(6)
  password: string;
}


