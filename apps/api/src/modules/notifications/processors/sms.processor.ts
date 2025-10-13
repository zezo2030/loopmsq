import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { SmsProvider } from '../providers/sms.provider';

@Processor('notifications_sms')
export class SmsProcessor {
  constructor(private readonly smsProvider: SmsProvider) {}

  @Process('send')
  async handleSend(job: Job<{ to: string; body: string }>): Promise<void> {
    const { to, body } = job.data;
    await this.smsProvider.send(to, body);
  }
}


