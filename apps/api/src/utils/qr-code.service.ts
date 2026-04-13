import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

export type TokenPrefixType = 'offer_ticket' | 'subscription' | 'legacy';

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

  /**
   * Generate an offer ticket QR token with OT: prefix
   * Format: OT:{ticketId}:{random8}
   */
  generateOfferTicketToken(ticketId: string): string {
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    return `OT:${ticketId}:${randomSuffix}`;
  }

  /**
   * Generate a subscription QR token with SP: prefix
   * Format: SP:{purchaseId}:{random8}
   */
  generateSubscriptionToken(purchaseId: string): string {
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    return `SP:${purchaseId}:${randomSuffix}`;
  }

  /**
   * Parse the prefix of a raw QR token to determine its type
   */
  parseTokenPrefix(rawToken: string): {
    type: TokenPrefixType;
    payload: string;
  } {
    if (rawToken.startsWith('OT:')) {
      return { type: 'offer_ticket', payload: rawToken };
    }
    if (rawToken.startsWith('SP:')) {
      return { type: 'subscription', payload: rawToken };
    }
    return { type: 'legacy', payload: rawToken };
  }

  /**
   * Hash a raw token using sha256
   */
  hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
