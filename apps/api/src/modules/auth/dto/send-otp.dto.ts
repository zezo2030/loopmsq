import { IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Language preference',
    example: 'ar',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string = 'ar';
}
