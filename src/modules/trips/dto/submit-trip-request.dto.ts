import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class SubmitTripRequestDto {
  @ApiPropertyOptional({ description: 'Optional note from requester' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}


