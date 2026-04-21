import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReviewGiftRefundDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
