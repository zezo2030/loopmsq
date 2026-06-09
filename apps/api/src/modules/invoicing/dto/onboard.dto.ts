import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OnboardDto {
  @ApiPropertyOptional({
    description:
      'OTP generated in the Fatoora portal. Falls back to ZATCA_ONBOARDING_OTP env.',
  })
  @IsOptional()
  @IsString()
  otp?: string;

  @ApiPropertyOptional({
    description: 'EGS serial (1-<solution>|2-<model>|3-<serial>). Auto if omitted.',
  })
  @IsOptional()
  @IsString()
  egsSerialNumber?: string;
}
