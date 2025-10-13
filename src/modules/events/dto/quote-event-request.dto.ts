import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class QuoteEventRequestDto {
  @ApiPropertyOptional({ description: 'Base price before add-ons' })
  @IsOptional()
  @IsInt()
  @Min(0)
  basePrice?: number;
}


