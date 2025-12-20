import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class WhatsAppProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);
  private http: AxiosInstance | null = null;
  private accessToken: string | undefined;
  private phoneNumberId: string | undefined;
  private lastConfigHash: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  private async loadConfig(): Promise<void> {
    try {
      const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
      const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');

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

  async sendOTP(to: string, otp: string, lang: 'ar' | 'en' = 'ar'): Promise<void> {
    await this.loadConfig();
    
    if (!this.http || !this.phoneNumberId) {
      this.logger.warn('WhatsApp not configured, skipping OTP send');
      return;
    }

    try {
      // استخدام القالب الجاهز authentication_code (مجاني)
      const templateName = 'authentication_code';
      
      // تحديد كود اللغة
      const languageCode = lang === 'ar' ? 'ar' : 'en';

      // تنظيف رقم الهاتف (إزالة + والمسافات)
      const cleanPhone = to.replace(/^\+/, '').replace(/\s/g, '');

      const response = await this.http.post('/messages', {
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
                  text: otp, // رمز OTP
                },
              ],
            },
          ],
        },
      });

      this.logger.log(`✅ WhatsApp OTP sent to ${to}: ${otp}`);
    } catch (e: any) {
      const errorMessage = e.response?.data?.error?.message || String(e);
      const errorCode = e.response?.data?.error?.code;
      this.logger.error(`❌ WhatsApp send failed: ${errorMessage} (Code: ${errorCode})`);
      // لا نرمي الخطأ حتى لا نوقف العملية إذا فشل WhatsApp
      // يمكن إضافة fallback إلى SMS لاحقاً
    }
  }
}



















