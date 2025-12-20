import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { WhatsAppProvider } from '../providers/whatsapp.provider';

@Processor('notifications_whatsapp')
export class WhatsAppProcessor {
  constructor(private readonly whatsappProvider: WhatsAppProvider) {}

  @Process('send')
  async handleSend(job: Job<{ to: string; otp: string; lang: 'ar' | 'en' }>): Promise<void> {
    const { to, otp, lang } = job.data;
    await this.whatsappProvider.sendOTP(to, otp, lang);
  }
}



















