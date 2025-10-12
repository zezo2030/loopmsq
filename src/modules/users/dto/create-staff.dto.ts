import {
  IsEmail,
  IsString,
  IsArray,
  IsOptional,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../common/decorators/roles.decorator';

export class CreateStaffDto {
  @ApiProperty({
    description: 'Staff email address',
    example: 'staff@booking.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Staff full name',
    example: 'Ahmed Ali',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Staff password',
    example: 'SecurePassword123',
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Staff roles',
    example: ['staff'],
    enum: UserRole,
    isArray: true,
  })
  @IsArray()
  roles: UserRole[];

  @ApiProperty({
    description: 'Phone number (optional)',
    example: '+966501234567',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Language preference',
    example: 'ar',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string = 'ar';
}
