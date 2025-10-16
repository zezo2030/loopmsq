import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AdjustWalletDto {
  @ApiPropertyOptional({ description: 'Amount to add/subtract to wallet balance' })
  @IsOptional()
  @IsNumber()
  balanceDelta?: number;

  @ApiPropertyOptional({ description: 'Points to add/subtract to loyalty points' })
  @IsOptional()
  @IsNumber()
  pointsDelta?: number;

  @ApiPropertyOptional({ description: 'Reason note for audit trail' })
  @IsOptional()
  @IsString()
  reason?: string;
}


