import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ClaimGiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  claimToken?: string;
}
