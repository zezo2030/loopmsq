import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSmsConfigDto {
  @ApiProperty({ description: 'Enable/disable SMS sending', required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({
    description: 'SMS provider',
    enum: ['dreams'],
    required: false,
  })
  @IsOptional()
  @IsIn(['dreams'])
  provider?: 'dreams';

  @ApiProperty({ description: 'Dreams API base URL', required: false, example: 'https://www.dreams.sa/index.php/api/sendsms/' })
  @IsOptional()
  @IsString()
  dreamsApiUrl?: string;

  @ApiProperty({ description: 'Dreams Account Username', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  dreamsUser?: string;

  @ApiProperty({ description: 'Dreams API Secret Key', required: false })
  @IsOptional()
  @IsString()
  @MinLength(6)
  dreamsSecretKey?: string;

  @ApiProperty({ description: 'Dreams Sender (name or number)', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  dreamsSender?: string;
}


