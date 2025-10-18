import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateOtpConfigDto {
  @ApiProperty({ description: 'Enable/disable OTP verification', required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'OTP length (digits)', minimum: 4, maximum: 8, required: false })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(8)
  length?: number;

  @ApiProperty({ description: 'OTP expiry in seconds', minimum: 60, maximum: 600, required: false })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(600)
  expirySeconds?: number;

  @ApiProperty({ description: 'Rate limit TTL seconds', required: false, default: 300 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  rateTtlSeconds?: number;

  @ApiProperty({ description: 'Rate limit max attempts within TTL', required: false, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rateMaxAttempts?: number;
}


