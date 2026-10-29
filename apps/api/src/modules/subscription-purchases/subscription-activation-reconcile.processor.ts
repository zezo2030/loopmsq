import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import {
  SubscriptionPurchase,
  SubscriptionPurchaseStatus,
} from '../../database/entities/subscription-purchase.entity';
import { SubscriptionPurchasesService } from './subscription-purchases.service';

/** Leave a fresh confirm alone so this never races the app's own request. */
const SETTLE_MINUTES = 5;

@Injectable()
export class SubscriptionActivationReconcileProcessor {
  private readonly logger = new Logger(
    SubscriptionActivationReconcileProcessor.name,
  );

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly purchasesService: SubscriptionPurchasesService,
  ) {}

  /**
   * A subscription whose payment is COMPLETED but which is still
   * pending_payment was paid for and never activated (activation failed after
   * the charge, or the app was closed before confirm). The customer can't see
   * it, so they buy again. This activates those purchases.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async activatePaidPendingSubscriptions(): Promise<void> {
    const cutoff = new Date(Date.now() - SETTLE_MINUTES * 60 * 1000);

    const stuck = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin(
        SubscriptionPurchase,
        'sp',
        'sp.id = p.subscriptionPurchaseId',
      )
      .select('DISTINCT p.subscriptionPurchaseId', 'purchaseId')
      .where('p.status = :paid', { paid: PaymentStatus.COMPLETED })
      .andWhere('sp.status = :pending', {
        pending: SubscriptionPurchaseStatus.PENDING_PAYMENT,
      })
      .andWhere('p.paidAt < :cutoff', { cutoff })
      .limit(100)
      .getRawMany<{ purchaseId: string }>();

    if (!stuck.length) return;

    let activated = 0;
    for (const { purchaseId } of stuck) {
      try {
        await this.purchasesService.confirmPayment(purchaseId);
        activated += 1;
      } catch (error) {
        this.logger.error(
          `Could not activate paid subscription ${purchaseId}: ${error?.message || error}`,
        );
      }
    }

    this.logger.warn(
      `Paid-but-pending subscriptions: ${activated}/${stuck.length} activated`,
    );
  }
}
