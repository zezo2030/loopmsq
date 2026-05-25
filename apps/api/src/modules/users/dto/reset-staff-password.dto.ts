import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetStaffPasswordDto {
  @ApiProperty({
    description: 'New password for the staff member',
    example: 'SecurePassword123',
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
