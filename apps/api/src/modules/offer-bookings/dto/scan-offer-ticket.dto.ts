import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanOfferTicketDto {
  @ApiProperty({
    description: 'Raw QR token from scanned code',
    example: 'OT:uuid:random_suffix',
  })
  @IsString()
  token: string;
}
