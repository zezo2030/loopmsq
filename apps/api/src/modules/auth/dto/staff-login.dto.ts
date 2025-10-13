import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StaffLoginDto {
  @ApiProperty({
    description: 'Staff email address',
    example: 'staff@booking.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Staff password',
    example: 'SecurePassword123',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
