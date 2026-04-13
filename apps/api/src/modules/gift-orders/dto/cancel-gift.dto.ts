import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelGiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
