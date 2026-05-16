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

import { Transform } from 'class-transformer';

export class CreateFreeTicketAdminDto {
  @ApiProperty({
    description: 'User ID to create ticket for',
    example: 'user-uuid',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Branch ID (required for Admin)',
    example: 'branch-uuid',
  })
  @Transform(({ obj }) => obj.branchId || obj.hallId)
  @IsUUID()
  branchId: string;

  @ApiProperty({
    description:
      'Optional booking start time. When omitted, the ticket has no fixed date — it is valid from the first scan for its duration.',
    example: '2024-01-15T14:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiProperty({
    description: 'Duration in hours',
    example: 3,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  durationHours: number;

  @ApiProperty({
    description: 'Number of persons (tickets to create). Defaults to 1.',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  persons?: number = 1;

  @ApiProperty({
    description: 'Special notes or requests',
    example: 'Free ticket for VIP customer',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
