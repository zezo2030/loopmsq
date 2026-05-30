import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

// Accepts a semantic version like "2", "2.1" or "2.1.0".
const SEMVER_REGEX = /^\d+(\.\d+){0,2}$/;

export class UpdateAppVersionConfigDto {
  @ApiProperty({
    description: 'Master switch for the forced-update gate',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    description: 'Minimum required version on Android (e.g. "2.1.0")',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(SEMVER_REGEX, { message: 'minRequiredVersionAndroid must be like 2.1.0' })
  minRequiredVersionAndroid?: string;

  @ApiProperty({
    description: 'Minimum required version on iOS (e.g. "2.1.0")',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(SEMVER_REGEX, { message: 'minRequiredVersionIos must be like 2.1.0' })
  minRequiredVersionIos?: string;

  @ApiProperty({
    description: 'Google Play store URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  androidStoreUrl?: string;

  @ApiProperty({
    description: 'App Store URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  iosStoreUrl?: string;

  @ApiProperty({
    description: 'Optional custom message shown on the update screen',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
}
