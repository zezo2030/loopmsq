import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { getZatcaConfig, ZatcaConfig } from '../../config/zatca.config';
import { InvoicingService } from './invoicing.service';

export const EINVOICE_QUEUE = 'einvoice_issue';
export const EINVOICE_ISSUE_JOB = 'issue';

/**
 * Decoupled, self-healing feeder for e-invoice issuance.
 *
 * A @Cron sweep finds completed payments without an e-invoice and enqueues one
 * job per payment. Jobs are deduplicated by jobId = paymentId so the same
 * payment is never queued twice while a previous job is still pending. This
 * never touches the payment transaction, so a ZATCA outage can't block checkout.
 *
 * Other services can also enqueue immediately via `enqueue(paymentId)`.
 */
@Injectable()
export class InvoiceQueueService {
  private readonly logger = new Logger(InvoiceQueueService.name);
  private readonly cfg: ZatcaConfig;
  private sweeping = false;

  constructor(
    @InjectQueue(EINVOICE_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
    private readonly invoicing: InvoicingService,
  ) {
    this.cfg = getZatcaConfig(configService);
  }

  async enqueue(paymentId: string): Promise<void> {
    if (!this.cfg.enabled) return;
    await this.queue.add(
      EINVOICE_ISSUE_JOB,
      { paymentId },
      {
        jobId: `einvoice:${this.cfg.environment}:${paymentId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    if (!this.cfg.enabled || this.sweeping) return;
    this.sweeping = true;
    try {
      const ids = await this.invoicing.findPaymentsNeedingInvoice(50);
      if (ids.length) {
        this.logger.log(`Enqueuing ${ids.length} payment(s) for e-invoicing`);
        for (const id of ids) await this.enqueue(id);
      }
    } catch (e: any) {
      this.logger.error(`e-invoice sweep failed: ${e?.message || e}`);
    } finally {
      this.sweeping = false;
    }
  }
}
