import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserLoginDto {
  @ApiProperty({
    description: 'Email address or phone number in international format',
    example: '+966501234567 or user@example.com',
  })
  @IsString()
  identifier: string;

  @ApiProperty({ description: 'Account password', example: 'StrongPass#2025' })
  @IsString()
  @MinLength(6)
  password: string;
}


