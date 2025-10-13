import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { EmailProvider } from '../providers/email.provider';

@Processor('notifications_email')
export class EmailProcessor {
  constructor(private readonly emailProvider: EmailProvider) {}

  @Process('send')
  async handleSend(job: Job<{ to: string; subject: string; html: string }>): Promise<void> {
    const { to, subject, html } = job.data;
    await this.emailProvider.send(to, subject, html);
  }
}


