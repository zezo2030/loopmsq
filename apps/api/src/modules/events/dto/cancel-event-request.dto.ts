import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CancelEventRequestDto {
  @ApiPropertyOptional({ description: 'Optional reason for cancelling' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}
