import {
  IsUUID,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFreeTicketDto {
  @ApiProperty({
    description: 'User ID to create ticket for',
    example: 'user-uuid',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Booking start time',
    example: '2024-01-15T14:00:00.000Z',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description: 'Duration in hours',
    example: 3,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  durationHours: number;

  @ApiProperty({
    description: 'Number of persons (tickets to create)',
    example: 1,
  })
  @IsInt()
  @Min(1)
  persons: number;

  @ApiProperty({
    description: 'Special notes or requests',
    example: 'Free ticket for VIP customer',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

