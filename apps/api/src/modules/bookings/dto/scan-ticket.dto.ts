import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanTicketDto {
  @ApiProperty({
    description: 'QR code token from the ticket',
    example: 'qr-token-hash-string',
  })
  @IsString()
  qrToken: string;
}
