import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../utils/redis.service';
import { EncryptionService } from '../../utils/encryption.util';
import { UpdateSmsConfigDto } from './dto/update-sms-config.dto';
import { UpdateOtpConfigDto } from './dto/update-otp-config.dto';
import { NotificationsService } from '../notifications/notifications.service';

type SmsConfig = {
  enabled: boolean;
  provider: 'whatsapp';
  whatsappAccessToken?: string; // encrypted at rest
  whatsappPhoneNumberId?: string;
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
      return { enabled: false, provider: 'whatsapp' };
    }
    if (!mask) return cfg;
    const masked: SmsConfig = { ...cfg };
    if (masked.whatsappAccessToken) masked.whatsappAccessToken = '****';
    return masked;
  }

  async updateSmsConfig(dto: UpdateSmsConfigDto): Promise<SmsConfig> {
    const current = ((await this.redis.get(this.smsKey)) as SmsConfig | null) || {
      enabled: false,
      provider: 'whatsapp',
    };
    const next: SmsConfig = {
      enabled: current.enabled ?? false,
      provider: 'whatsapp',
      whatsappAccessToken: current.whatsappAccessToken,
      whatsappPhoneNumberId: current.whatsappPhoneNumberId,
    };

    if (dto.enabled !== undefined) next.enabled = dto.enabled;
    if (dto.provider) next.provider = dto.provider;
    if (dto.whatsappPhoneNumberId !== undefined)
      next.whatsappPhoneNumberId = dto.whatsappPhoneNumberId;
    if (dto.whatsappAccessToken)
      next.whatsappAccessToken = this.encryption.encrypt(dto.whatsappAccessToken);

    await this.redis.set(this.smsKey, next);
    return this.getSmsConfig(true);
  }

  async testSms(to: string, message: string): Promise<{ success: boolean }> {
    if (!to || !message) throw new BadRequestException('to and message required');
    // Use notifications pipeline to send test WhatsApp OTP
    await this.notifications.enqueue({
      type: 'OTP',
      to: { phone: to },
      data: { otp: message },
      channels: ['whatsapp'],
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


