import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../utils/redis.service';
import { EncryptionService } from '../../utils/encryption.util';
import { UpdateSmsConfigDto } from './dto/update-sms-config.dto';
import { UpdateOtpConfigDto } from './dto/update-otp-config.dto';
import { NotificationsService } from '../notifications/notifications.service';

type SmsConfig = {
  enabled: boolean;
  provider: 'twilio';
  twilioAccountSid?: string; // encrypted at rest
  twilioAuthToken?: string; // encrypted at rest
  twilioFromNumber?: string;
};

type OtpConfig = {
  enabled: boolean;
  length: number;
  expirySeconds: number;
  rateTtlSeconds: number;
  rateMaxAttempts: number;
};

@Injectable()
export class AdminConfigService {
  private readonly logger = new Logger(AdminConfigService.name);
  private readonly smsKey = 'config:sms';
  private readonly otpKey = 'config:otp';

  constructor(
    private readonly redis: RedisService,
    private readonly encryption: EncryptionService,
    private readonly notifications: NotificationsService,
  ) {}

  async getSmsConfig(mask = true): Promise<SmsConfig> {
    const cfg = (await this.redis.get(this.smsKey)) as SmsConfig | null;
    if (!cfg) {
      return { enabled: false, provider: 'twilio' };
    }
    if (!mask) return cfg;
    const masked: SmsConfig = { ...cfg };
    if (masked.twilioAccountSid) masked.twilioAccountSid = '****';
    if (masked.twilioAuthToken) masked.twilioAuthToken = '****';
    return masked;
  }

  async updateSmsConfig(dto: UpdateSmsConfigDto): Promise<SmsConfig> {
    const current = ((await this.redis.get(this.smsKey)) as SmsConfig | null) || {
      enabled: false,
      provider: 'twilio',
    };
    const next: SmsConfig = { ...current };

    if (dto.enabled !== undefined) next.enabled = dto.enabled;
    if (dto.provider) next.provider = dto.provider;
    if (dto.twilioFromNumber !== undefined)
      next.twilioFromNumber = dto.twilioFromNumber;
    if (dto.twilioAccountSid)
      next.twilioAccountSid = this.encryption.encrypt(dto.twilioAccountSid);
    if (dto.twilioAuthToken)
      next.twilioAuthToken = this.encryption.encrypt(dto.twilioAuthToken);

    await this.redis.set(this.smsKey, next);
    return this.getSmsConfig(true);
  }

  async testSms(to: string, message: string): Promise<{ success: boolean }> {
    if (!to || !message) throw new BadRequestException('to and message required');
    // Use notifications pipeline to send test SMS
    await this.notifications.enqueue({
      type: 'OTP',
      to: { phone: to },
      data: { otp: message },
      channels: ['sms'],
      lang: 'ar',
    });
    return { success: true };
  }

  async getOtpConfig(): Promise<OtpConfig> {
    const cfg = (await this.redis.get(this.otpKey)) as OtpConfig | null;
    return (
      cfg || {
        enabled: true,
        length: 6,
        expirySeconds: 300,
        rateTtlSeconds: 300,
        rateMaxAttempts: 3,
      }
    );
  }

  async updateOtpConfig(dto: UpdateOtpConfigDto): Promise<OtpConfig> {
    const current = await this.getOtpConfig();
    const next: OtpConfig = { ...current };
    if (dto.enabled !== undefined) next.enabled = dto.enabled;
    if (dto.length !== undefined) next.length = dto.length;
    if (dto.expirySeconds !== undefined) next.expirySeconds = dto.expirySeconds;
    if (dto.rateTtlSeconds !== undefined)
      next.rateTtlSeconds = dto.rateTtlSeconds;
    if (dto.rateMaxAttempts !== undefined)
      next.rateMaxAttempts = dto.rateMaxAttempts;
    await this.redis.set(this.otpKey, next);
    return next;
  }
}


