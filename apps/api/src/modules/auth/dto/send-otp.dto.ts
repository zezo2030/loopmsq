import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({
    description: 'Phone number in international format',
    example: '+966501234567',
  })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'Language preference',
    example: 'ar',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string = 'ar';
}
