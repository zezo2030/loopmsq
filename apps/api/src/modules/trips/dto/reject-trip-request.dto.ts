import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class RejectTripRequestDto {
  @ApiProperty({ description: 'Reason for rejecting the trip request' })
  @IsString()
  @Length(2, 500)
  rejectionReason: string;

  @ApiPropertyOptional({ description: 'Optional admin notes' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  adminNotes?: string;
}
