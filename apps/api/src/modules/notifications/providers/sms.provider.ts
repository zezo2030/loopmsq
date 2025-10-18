import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';
import { RedisService } from '../../../utils/redis.service';
import { EncryptionService } from '../../../utils/encryption.util';

@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);
  private client: Twilio.Twilio | null = null;
  private fromNumber: string | undefined;
  private lastConfigHash: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly encryption: EncryptionService,
  ) {}

  private async loadConfig(): Promise<void> {
    // Prefer Redis config; fallback to env
    try {
      const cfg = (await this.redis.get('config:sms')) as {
        enabled?: boolean;
        provider?: 'twilio';
        twilioAccountSid?: string;
        twilioAuthToken?: string;
        twilioFromNumber?: string;
      } | null;

      const envSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
      const envToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
      const envFrom = this.configService.get<string>('TWILIO_FROM_NUMBER');

      const sid = cfg?.twilioAccountSid
        ? this.encryption.decrypt(cfg.twilioAccountSid)
        : envSid;
      const token = cfg?.twilioAuthToken
        ? this.encryption.decrypt(cfg.twilioAuthToken)
        : envToken;
      const from = cfg?.twilioFromNumber || envFrom;

      const hash = [sid || '', token || '', from || ''].join('|');
      if (this.lastConfigHash !== hash) {
        this.lastConfigHash = hash;
        if (sid && token) {
          this.client = Twilio(sid, token);
          this.fromNumber = from;
        } else {
          this.client = null;
          this.fromNumber = undefined;
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to load SMS config: ${String(e)}`);
    }
  }

  async send(to: string, body: string): Promise<void> {
    await this.loadConfig();
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


