import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

export class WebhookEventDto {
  @ApiProperty()
  @IsString()
  eventType: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  data: Record<string, any>;
}


