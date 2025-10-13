import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class IssueTicketsDto {
  @ApiProperty({ description: 'Trip start time (ISO)' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Duration in hours' })
  @IsInt()
  @Min(1)
  durationHours: number;

  @ApiPropertyOptional({ description: 'Welcome/marketing message to guardians' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  welcomeMessage?: string;
}


