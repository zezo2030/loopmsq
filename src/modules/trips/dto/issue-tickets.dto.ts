import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Min } from 'class-validator';

export class IssueTicketsDto {
  @ApiProperty({ description: 'Trip start time (ISO)' })
  @IsDateString()
  startTime: string as unknown as Date;

  @ApiProperty({ description: 'Duration in hours' })
  @IsInt()
  @Min(1)
  durationHours: number;
}


