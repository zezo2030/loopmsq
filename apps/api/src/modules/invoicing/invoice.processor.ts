import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InvoicingService } from './invoicing.service';
import { EINVOICE_QUEUE, EINVOICE_ISSUE_JOB } from './invoice-queue.service';

@Processor(EINVOICE_QUEUE)
export class InvoiceProcessor {
  private readonly logger = new Logger(InvoiceProcessor.name);

  constructor(private readonly invoicing: InvoicingService) {}

  @Process(EINVOICE_ISSUE_JOB)
  async handleIssue(job: Job<{ paymentId: string }>) {
    const { paymentId } = job.data;
    this.logger.log(`Issuing e-invoice for payment ${paymentId}`);
    const invoice = await this.invoicing.issueInvoiceForPayment(paymentId);
    if (!invoice) {
      this.logger.log(`No invoice issued for payment ${paymentId} (skipped)`);
      return { skipped: true };
    }
    this.logger.log(
      `Invoice ${invoice.invoiceNumber} -> ${invoice.status} (payment ${paymentId})`,
    );
    return { invoiceId: invoice.id, status: invoice.status };
  }
}
