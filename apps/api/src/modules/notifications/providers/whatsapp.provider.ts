import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { RedisService } from '../../../utils/redis.service';
import { EncryptionService } from '../../../utils/encryption.util';

@Injectable()
export class WhatsAppProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);
  private http: AxiosInstance | null = null;
  private accessToken: string | undefined;
  private phoneNumberId: string | undefined;
  private lastConfigHash: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly encryption: EncryptionService,
  ) {}

  private async resolveConfig(): Promise<{
    accessToken?: string;
    phoneNumberId?: string;
  }> {
    // Primary source: environment variables
    const envAccessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const envPhoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (envAccessToken && envPhoneNumberId) {
      return { accessToken: envAccessToken, phoneNumberId: envPhoneNumberId };
    }

    // Fallback: admin configuration stored in Redis
    try {
      const cfg = (await this.redis.get('config:sms')) as
        | {
            enabled?: boolean;
            provider?: string;
            whatsappAccessToken?: string;
            whatsappPhoneNumberId?: string;
          }
        | null;
      if (!cfg || cfg.enabled === false || cfg.provider !== 'whatsapp') {
        return {};
      }

      let accessToken = cfg.whatsappAccessToken;
      if (accessToken) {
        try {
          accessToken = this.encryption.decrypt(accessToken);
        } catch {
          // Keep plaintext values for backward compatibility.
        }
      }

      return {
        accessToken,
        phoneNumberId: cfg.whatsappPhoneNumberId,
      };
    } catch (e) {
      this.logger.warn(`Failed to read WhatsApp config from Redis: ${String(e)}`);
      return {};
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const { accessToken, phoneNumberId } = await this.resolveConfig();

      const hash = [accessToken || '', phoneNumberId || ''].join('|');
      if (this.lastConfigHash !== hash) {
        this.lastConfigHash = hash;
        if (accessToken && phoneNumberId) {
          this.http = axios.create({
            baseURL: `https://graph.facebook.com/v18.0/${phoneNumberId}`,
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          });
          this.accessToken = accessToken;
          this.phoneNumberId = phoneNumberId;
          this.logger.log('WhatsApp provider configured successfully');
        } else {
          this.http = null;
          this.accessToken = undefined;
          this.phoneNumberId = undefined;
          this.logger.warn('WhatsApp not configured - missing required environment variables');
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to load WhatsApp config: ${String(e)}`);
    }
  }

  private getTemplateName(): string {
    return this.configService.get<string>('WHATSAPP_OTP_TEMPLATE_NAME') || 'ver_number';
  }

  private getForcedTemplateLanguage(): string | null {
    const forced = this.configService.get<string>('WHATSAPP_OTP_LANGUAGE');
    if (!forced) return null;
    const normalized = forced.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private getLanguageCandidates(lang: 'ar' | 'en'): string[] {
    const forced = this.getForcedTemplateLanguage();
    if (forced) {
      // Force a specific template language from env (recommended for single-language templates).
      return [forced];
    }

    const preferred = lang === 'ar' ? ['ar', 'ar_SA', 'ar_EG'] : ['en_US', 'en', 'en_GB'];
    // Cross-language fallback if preferred language translation is unavailable.
    const fallback = lang === 'ar' ? ['en_US', 'en', 'en_GB'] : ['ar', 'ar_SA', 'ar_EG'];
    return Array.from(new Set([...preferred, ...fallback]));
  }

  async sendOTP(to: string, otp: string, lang: 'ar' | 'en' = 'ar'): Promise<void> {
    await this.loadConfig();
    
    if (!this.http || !this.phoneNumberId) {
      this.logger.warn('WhatsApp not configured, skipping OTP send');
      return;
    }

    // تنظيف رقم الهاتف (إزالة + والمسافات)
    const cleanPhone = to.replace(/^\+/, '').replace(/\s/g, '');
    const templateName = this.getTemplateName();
    const languageCandidates = this.getLanguageCandidates(lang);

    for (const languageCode of languageCandidates) {
      try {
        await this.http.post('/messages', {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: otp,
                  },
                ],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  {
                    type: 'text',
                    text: otp,
                  },
                ],
              },
            ],
          },
        });

        this.logger.log(
          `✅ WhatsApp OTP sent to ${to} using template "${templateName}" and language "${languageCode}"`,
        );
        return;
      } catch (e: any) {
        const errorMessage = e.response?.data?.error?.message || String(e);
        const errorCode = e.response?.data?.error?.code;
        const isRetryable =
          errorCode === 132001 || // missing translation
          errorCode === 132005 || // template not found
          errorCode === 132015;   // template paused

        if (isRetryable && languageCandidates.indexOf(languageCode) < languageCandidates.length - 1) {
          this.logger.warn(
            `Template "${templateName}" is not available for language "${languageCode}". Trying fallback language...`,
          );
          continue;
        }

        this.logger.error(
          `❌ WhatsApp send failed: ${errorMessage} (Code: ${errorCode}) — tried languages: [${languageCandidates.join(', ')}]`,
        );
        return;
      }
    }

    this.logger.error(
      `❌ WhatsApp send failed: template "${templateName}" exhausted all language candidates [${languageCandidates.join(', ')}] for preferred language "${lang}"`,
    );
    // Do not throw to avoid breaking auth flow when WhatsApp fails.
  }
}























