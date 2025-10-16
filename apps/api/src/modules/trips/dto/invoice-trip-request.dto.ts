import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class InvoiceTripRequestDto {
  @ApiPropertyOptional({ description: 'Override quoted price (minor units optional)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  overrideAmount?: number;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsOptional()
  @IsString()
  currency?: string;
}


