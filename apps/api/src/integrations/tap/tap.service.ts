import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { TapClient, TapCreateChargeRequest, TapCharge } from './tap.client';

@Injectable()
export class TapService {
  private client: TapClient;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get<string>('TAP_API_BASE') || 'https://api.tap.company';
    const secret = this.configService.get<string>('TAP_SECRET_KEY') || '';
    this.client = new TapClient(baseUrl, secret);
  }

  async createCharge(payload: TapCreateChargeRequest): Promise<TapCharge> {
    return this.client.createCharge(payload);
  }

  async retrieveCharge(chargeId: string): Promise<TapCharge> {
    return this.client.retrieveCharge(chargeId);
  }

  // NOTE: يتطلب rawBody عادة؛ هنا بديل مبسط يعمل إذا مررنا النص الأصلي
  verifyWebhookSignature(rawBody: string, signatureFromHeader?: string): boolean {
    const secret = this.configService.get<string>('PAYMENT_WEBHOOK_SECRET') || '';
    if (!secret || !signatureFromHeader) return false;
    const computed = createHmac('sha256', secret).update(rawBody).digest('hex');
    return computed === signatureFromHeader;
  }
}


