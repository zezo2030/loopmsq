import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { GiftStatus } from '../../../database/entities/gift-order.entity';

export class ListGiftOrdersDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: GiftStatus })
  @IsOptional()
  @IsEnum(GiftStatus)
  status?: GiftStatus;
}
