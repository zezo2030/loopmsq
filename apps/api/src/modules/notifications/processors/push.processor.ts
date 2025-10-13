import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PushProvider } from '../providers/push.provider';

@Processor('notifications_push')
export class PushProcessor {
  constructor(private readonly push: PushProvider) {}

  @Process('send')
  async handleSend(job: Job<{ tokens: string[]; title: string; body: string; data?: Record<string, string> }>): Promise<void> {
    const { tokens, title, body, data } = job.data;
    await this.push.sendToTokens(tokens, title, body, data);
  }
}


