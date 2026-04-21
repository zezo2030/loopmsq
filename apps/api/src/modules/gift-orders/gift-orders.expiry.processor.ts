import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  GiftOrder,
  GiftStatus,
  GiftPaymentStatus,
  GiftRefundRequestStatus,
} from '../../database/entities/gift-order.entity';
import { GiftOrderEvent } from '../../database/entities/gift-order-event.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class GiftOrdersExpiryProcessor {
  private readonly logger = new Logger(GiftOrdersExpiryProcessor.name);

  constructor(
    @InjectRepository(GiftOrder)
    private readonly giftOrderRepo: Repository<GiftOrder>,
    @InjectRepository(GiftOrderEvent)
    private readonly giftOrderEventRepo: Repository<GiftOrderEvent>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredGifts() {
    this.logger.log('Starting gift expiry processing...');

    const expiredGifts = await this.giftOrderRepo
      .createQueryBuilder('go')
      .where('go.giftStatus = :status', { status: GiftStatus.PENDING_CLAIM })
      .andWhere('go.paymentStatus = :paymentStatus', {
        paymentStatus: GiftPaymentStatus.PAID,
      })
      .andWhere('go.claimTokenExpiresAt < :now', { now: new Date() })
      .getMany();

    this.logger.log(`Found ${expiredGifts.length} expired gifts to process`);

    for (const gift of expiredGifts) {
      try {
        await this.processExpiredGift(gift);
      } catch (error) {
        this.logger.error(
          `Failed to process expired gift ${gift.id}: ${error.message}`,
        );
      }
    }

    this.logger.log('Gift expiry processing completed');
  }

  private async processExpiredGift(gift: GiftOrder): Promise<void> {
    const payment = await this.paymentRepo.findOne({
      where: { giftOrderId: gift.id, status: PaymentStatus.COMPLETED },
    });

    if (!payment) {
      this.logger.warn(`No completed payment found for gift ${gift.id}`);
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const requestedAt = new Date();
      gift.giftStatus = GiftStatus.EXPIRED;
      gift.refundRequestStatus = GiftRefundRequestStatus.PENDING;
      gift.refundRequestedAt = requestedAt;
      gift.refundRequestedByUserId = null;
      gift.refundRequestReason = 'Gift claim window expired';
      gift.refundReviewedAt = null;
      gift.refundReviewedByUserId = null;
      gift.refundReviewNote = null;
      gift.refundWalletReference = null;
      gift.metadata = {
        ...(gift.metadata || {}),
        claimStatus: GiftStatus.EXPIRED,
        refundRequestedAt: requestedAt.toISOString(),
      };
      await queryRunner.manager.save(gift);

      const event = new GiftOrderEvent();
      event.giftOrderId = gift.id;
      event.eventType = 'gift_expired';
      event.actorType = 'system';
      event.actorId = '';
      event.payload = { refundRequestStatus: GiftRefundRequestStatus.PENDING };
      await queryRunner.manager.save(event);

      const refundEvent = new GiftOrderEvent();
      refundEvent.giftOrderId = gift.id;
      refundEvent.eventType = 'gift_refund_requested';
      refundEvent.actorType = 'system';
      refundEvent.actorId = '';
      refundEvent.payload = {
        paymentId: payment.id,
        reason: 'Gift claim window expired',
      };
      await queryRunner.manager.save(refundEvent);

      await queryRunner.commitTransaction();

      await this.notificationsService
        .enqueue({
          type: 'GIFT_EXPIRED',
          to: { userId: gift.senderUserId },
          data: {
            productTitle: gift.sourceProductSnapshot?.title ?? '',
            reason: 'انتهت فترة استلام الهدية وتم إعادة المبلغ',
          },
          channels: ['push'],
          lang: 'ar',
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to notify sender about expiry: ${err.message}`,
          ),
        );

      this.logger.log(`Processed expired gift ${gift.id}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
