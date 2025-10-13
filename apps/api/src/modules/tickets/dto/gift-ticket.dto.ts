import { IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GiftTicketDto {
  @ApiPropertyOptional({ description: 'New holder name' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  holderName?: string;

  @ApiPropertyOptional({ description: 'New holder phone' })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  holderPhone?: string;
}


