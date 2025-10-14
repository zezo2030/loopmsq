import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveEarningDto {
  @ApiPropertyOptional({ description: 'Optional note/reason' })
  @IsOptional()
  @IsString()
  note?: string;
}


