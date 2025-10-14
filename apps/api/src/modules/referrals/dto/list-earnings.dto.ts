import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ReferralEarningStatus } from '../../../database/entities/referral-earning.entity';

export class ListEarningsDto {
  @ApiPropertyOptional({ enum: ReferralEarningStatus })
  @IsOptional()
  @IsEnum(ReferralEarningStatus)
  status?: ReferralEarningStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  referrerId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;
}


