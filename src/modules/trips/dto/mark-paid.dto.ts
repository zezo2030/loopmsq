import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class MarkPaidDto {
  @ApiPropertyOptional({ description: 'Payment reference or note (cash/manual)' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  reference?: string;
}


