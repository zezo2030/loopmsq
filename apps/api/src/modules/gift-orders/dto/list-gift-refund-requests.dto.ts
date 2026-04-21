import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GiftRefundRequestStatus } from '../../../database/entities/gift-order.entity';

export class ListGiftRefundRequestsDto {
  @ApiPropertyOptional({
    enum: GiftRefundRequestStatus,
    description: 'Refund request status filter',
  })
  @IsOptional()
  @IsEnum(GiftRefundRequestStatus)
  status?: GiftRefundRequestStatus;

  @ApiPropertyOptional({ description: 'Search by sender, phone, or product title' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
