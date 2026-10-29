import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bull';
import { In, Repository } from 'typeorm';
import { DeviceToken } from '../../../database/entities/device-token.entity';
import { PushProvider } from '../providers/push.provider';

@Processor('notifications_push')
export class PushProcessor {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(
    private readonly push: PushProvider,
    @InjectRepository(DeviceToken)
    private readonly tokenRepo: Repository<DeviceToken>,
  ) {}

  @Process('send')
  async handleSend(
    job: Job<{
      tokens: string[];
      title: string;
      body: string;
      data?: Record<string, string>;
    }>,
  ): Promise<void> {
    const { tokens, title, body, data } = job.data;
    const result = await this.push.sendToTokens(tokens, title, body, data);

    // Drop tokens of uninstalled apps so broadcasts keep shrinking instead of
    // failing against the same dead devices forever.
    if (result.invalidTokens.length) {
      try {
        await this.tokenRepo.delete({ token: In(result.invalidTokens) });
        this.logger.log(
          `[PUSH] Removed ${result.invalidTokens.length} dead device tokens`,
        );
      } catch (e) {
        this.logger.warn(
          `[PUSH] Failed to remove dead device tokens: ${(e as Error)?.message}`,
        );
      }
    }
  }
}
