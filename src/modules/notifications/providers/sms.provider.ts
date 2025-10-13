import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';

@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);
  private readonly client: Twilio.Twilio | null = null;
  private readonly fromNumber: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const sid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER');
    if (sid && token) {
      this.client = Twilio(sid, token);
    }
  }

  async send(to: string, body: string): Promise<void> {
    if (this.client && this.fromNumber) {
      try {
        await this.client.messages.create({ to, from: this.fromNumber, body });
        return;
      } catch (e) {
        this.logger.error(`Twilio send failed: ${String(e)}`);
      }
    }
    // Fallback to log in non-configured environments
    this.logger.log(`[SMS] to=${to} body=${body}`);
  }
}


