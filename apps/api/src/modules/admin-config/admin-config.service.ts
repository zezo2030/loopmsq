import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../utils/redis.service';
import { EncryptionService } from '../../utils/encryption.util';
import { UpdateSmsConfigDto } from './dto/update-sms-config.dto';
import { UpdateOtpConfigDto } from './dto/update-otp-config.dto';
import { NotificationsService } from '../notifications/notifications.service';

type SmsConfig = {
  enabled: boolean;
  provider: 'whatsapp';
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  publicContactWhatsappPhone?: string;
};

type OtpConfig = {
  enabled: boolean;
  length: number;
  expirySeconds: number;
  rateTtlSeconds: number;
  rateMaxAttempts: number;
};

type PrivateEventTermsConfig = {
  terms: string[];
};

type TestGiftTemplatePayload = {
  to: string;
  senderName: string;
  productTitle: string;
  branchName: string;
  claimUrl: string;
};

@Injectable()
export class AdminConfigService {
  private readonly logger = new Logger(AdminConfigService.name);
  private readonly smsKey = 'config:sms';
  private readonly otpKey = 'config:otp';
  private readonly privateEventTermsKey = 'config:private-event-terms';

  static readonly DEFAULT_PRIVATE_EVENT_TERMS = [
    '\u0639\u062f\u062f \u0627\u0644\u0623\u0641\u0631\u0627\u062f \u0644\u0627 \u064a\u0632\u064a\u062f \u0639\u0646 15 \u0634\u062e\u0635\u0627\u064b.',
    '\u0627\u0644\u0625\u064a\u062c\u0627\u0631 \u0627\u0644\u0623\u0633\u0627\u0633\u064a \u0644\u0644\u0635\u0627\u0644\u0629 200 \u0631\u064a\u0627\u0644.',
    '\u0627\u0644\u0628\u064a\u062a\u0632\u0627 \u062a\u0643\u0641\u064a 3 \u0623\u0634\u062e\u0627\u0635 \u0641\u064a \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0627\u062a \u0627\u0644\u062e\u0627\u0635\u0629.',
    '\u0644\u0627 \u062a\u0648\u062c\u062f \u0648\u062c\u0628\u0629 \u0628\u0631\u062c\u0631 \u0636\u0645\u0646 \u0625\u0636\u0627\u0641\u0627\u062a \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0627\u062a \u0627\u0644\u062e\u0627\u0635\u0629.',
    '\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062d\u062c\u0632 \u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0645\u0648\u0639\u062f \u0645\u062d\u062c\u0648\u0632\u0627\u064b \u0645\u0633\u0628\u0642\u0627\u064b.',
    '\u0628\u0639\u062f \u0625\u062a\u0645\u0627\u0645 \u0627\u0644\u062f\u0641\u0639 \u064a\u064f\u0624\u0643\u0651\u064e\u062f \u0627\u0644\u062d\u062c\u0632 \u0641\u0648\u0631\u0627\u064b \u062f\u0648\u0646 \u0627\u0646\u062a\u0638\u0627\u0631 \u0645\u0648\u0627\u0641\u0642\u0629 \u0625\u062f\u0627\u0631\u064a\u0629.',
  ];

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
    const current = ((await this.redis.get(
      this.smsKey,
    )) as SmsConfig | null) || {
      enabled: false,
      provider: 'whatsapp',
    };

    const next: SmsConfig = {
      enabled: current.enabled ?? false,
      provider: 'whatsapp',
      whatsappAccessToken: current.whatsappAccessToken,
      whatsappPhoneNumberId: current.whatsappPhoneNumberId,
      publicContactWhatsappPhone: current.publicContactWhatsappPhone,
    };

    if (dto.enabled !== undefined) next.enabled = dto.enabled;
    if (dto.provider) next.provider = dto.provider;
    if (dto.whatsappPhoneNumberId !== undefined) {
      next.whatsappPhoneNumberId = dto.whatsappPhoneNumberId;
    }
    if (dto.publicContactWhatsappPhone !== undefined) {
      next.publicContactWhatsappPhone = dto.publicContactWhatsappPhone;
    }
    if (dto.whatsappAccessToken) {
      next.whatsappAccessToken = this.encryption.encrypt(
        dto.whatsappAccessToken,
      );
    }

    await this.redis.set(this.smsKey, next);
    return this.getSmsConfig(true);
  }

  async testSms(to: string, message: string): Promise<{ success: boolean }> {
    if (!to || !message) {
      throw new BadRequestException('to and message required');
    }

    await this.notifications.enqueue({
      type: 'OTP',
      to: { phone: to },
      data: { otp: message },
      channels: ['whatsapp'],
      lang: 'ar',
    });

    return { success: true };
  }

  async testGiftTemplate(
    payload: TestGiftTemplatePayload,
  ): Promise<{ success: boolean }> {
    if (
      !payload.to ||
      !payload.senderName ||
      !payload.productTitle ||
      !payload.branchName ||
      !payload.claimUrl
    ) {
      throw new BadRequestException(
        'to, senderName, productTitle, branchName, and claimUrl are required',
      );
    }

    await this.notifications.enqueue({
      type: 'GIFT_INVITE',
      to: { phone: payload.to },
      data: {
        senderName: payload.senderName,
        productTitle: payload.productTitle,
        branchName: payload.branchName,
        claimUrl: payload.claimUrl,
        deepLinkUrl: payload.claimUrl,
      },
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
    if (dto.rateTtlSeconds !== undefined) {
      next.rateTtlSeconds = dto.rateTtlSeconds;
    }
    if (dto.rateMaxAttempts !== undefined) {
      next.rateMaxAttempts = dto.rateMaxAttempts;
    }

    await this.redis.set(this.otpKey, next);
    return next;
  }

  async getPrivateEventTermsConfig(): Promise<PrivateEventTermsConfig> {
    const cfg = (await this.redis.get(
      this.privateEventTermsKey,
    )) as PrivateEventTermsConfig | null;
    const terms = this.sanitizeTerms(cfg?.terms);

    return {
      terms:
        terms.length > 0
          ? terms
          : [...AdminConfigService.DEFAULT_PRIVATE_EVENT_TERMS],
    };
  }

  async updatePrivateEventTermsConfig(dto: {
    terms?: string[];
  }): Promise<PrivateEventTermsConfig> {
    const terms = this.sanitizeTerms(dto.terms);
    if (terms.length === 0) {
      throw new BadRequestException(
        'At least one private event term is required',
      );
    }

    const next: PrivateEventTermsConfig = { terms };
    await this.redis.set(this.privateEventTermsKey, next);
    return next;
  }

  private sanitizeTerms(terms?: string[] | null): string[] {
    if (!Array.isArray(terms)) return [];

    return terms
      .map((term) => String(term ?? '').trim())
      .filter((term) => term.length > 0);
  }
}
