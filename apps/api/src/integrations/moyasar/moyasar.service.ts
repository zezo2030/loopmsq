import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MoyasarClient, MoyasarPayment } from './moyasar.client';

@Injectable()
export class MoyasarService {
  private readonly client: MoyasarClient;

  constructor(private readonly configService: ConfigService) {
    const baseUrl =
      this.configService.get<string>('MOYASAR_API_BASE') ||
      'https://api.moyasar.com/v1';
    const secret = this.configService.get<string>('MOYASAR_SECRET_KEY') || '';
    this.client = new MoyasarClient(baseUrl, secret);
  }

  async retrievePayment(paymentId: string): Promise<MoyasarPayment> {
    return this.client.retrievePayment(paymentId);
  }
}
