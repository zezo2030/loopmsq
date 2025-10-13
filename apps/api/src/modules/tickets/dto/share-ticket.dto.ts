import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ShareTicketDto {
  @ApiPropertyOptional({ description: 'TTL in seconds for the share token (60-86400)' })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(86400)
  ttlSeconds?: number;
}


