import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class WebhookEventDto {
  @ApiPropertyOptional({ description: 'Moyasar event id (evt_...)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({
    description: 'Moyasar event type, e.g. payment_paid, payment_failed',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Legacy/internal event type alias' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({ description: 'Moyasar webhook shared secret token' })
  @IsOptional()
  @IsString()
  secret_token?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  account_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  live?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  created_at?: string;
}
