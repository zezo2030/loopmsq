import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

@Injectable()
export class QRCodeService {
  async generateQRCode(data: string): Promise<string> {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 256,
      });

      return qrCodeDataURL;
    } catch (error: any) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  generateQRToken(bookingId: string, ticketId: string): string {
    const timestamp = Date.now().toString();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const data = `${bookingId}:${ticketId}:${timestamp}:${randomBytes}`;

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateQRTokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  verifyQRToken(token: string, hash: string): boolean {
    const computedHash = this.generateQRTokenHash(token);
    return computedHash === hash;
  }
}
