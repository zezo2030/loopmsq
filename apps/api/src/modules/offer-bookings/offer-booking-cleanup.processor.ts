import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  OfferBooking,
  OfferBookingPaymentStatus,
  OfferBookingStatus,
} from '../../database/entities/offer-booking.entity';
import { OfferTicket } from '../../database/entities/offer-ticket.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';

/** A checkout is treated as abandoned once it is this old and still unpaid. */
const ABANDONED_AFTER_HOURS = 3;

@Injectable()
export class OfferBookingCleanupProcessor {
  private readonly logger = new Logger(OfferBookingCleanupProcessor.name);

  constructor(
    @InjectRepository(OfferBooking)
    private readonly bookingRepo: Repository<OfferBooking>,
    @InjectRepository(OfferTicket)
    private readonly ticketRepo: Repository<OfferTicket>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  /**
   * Every payment retry creates a fresh booking, so abandoned checkouts pile up
   * in the user's list as entries that carry no ticket. This closes them out.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cancelAbandonedCheckouts(): Promise<void> {
    const cutoff = new Date(
      Date.now() - ABANDONED_AFTER_HOURS * 60 * 60 * 1000,
    );

    const candidates = await this.bookingRepo.find({
      where: {
        paymentStatus: OfferBookingPaymentStatus.PENDING,
        status: OfferBookingStatus.ACTIVE,
        createdAt: LessThan(cutoff),
      },
      order: { createdAt: 'ASC' },
      take: 500,
    });

    if (!candidates.length) return;

    let cancelled = 0;
    let skipped = 0;

    for (const booking of candidates) {
      try {
        if (await this.cancelIfAbandoned(booking)) {
          cancelled += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        this.logger.error(
          `Failed to clean up offer booking ${booking.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Abandoned offer checkouts: ${cancelled} cancelled, ${skipped} left for review`,
    );
  }

  private async cancelIfAbandoned(booking: OfferBooking): Promise<boolean> {
    // A ticket means the booking was paid for; never touch it.
    const ticketCount = await this.ticketRepo.count({
      where: { offerBookingId: booking.id },
    });
    if (ticketCount > 0) return false;

    const payments = await this.paymentRepo.find({
      where: { offerBookingId: booking.id },
    });

    if (payments.some((p) => p.status === PaymentStatus.COMPLETED)) {
      this.logger.warn(
        `Offer booking ${booking.id} has a completed payment but no ticket - needs manual review`,
      );
      return false;
    }

    // Reaching the gateway while still `processing` means the charge outcome is
    // unknown here. Leave those alone rather than risk cancelling a paid order.
    const awaitingGateway = payments.some(
      (p) => p.status === PaymentStatus.PROCESSING && !!p.gatewayRef,
    );
    if (awaitingGateway) {
      this.logger.warn(
        `Offer booking ${booking.id} has an unresolved gateway payment - needs reconciliation`,
      );
      return false;
    }

    booking.status = OfferBookingStatus.CANCELLED;
    booking.paymentStatus = OfferBookingPaymentStatus.FAILED;
    await this.bookingRepo.save(booking);

    const openPayments = payments.filter((p) =>
      [PaymentStatus.PENDING, PaymentStatus.PROCESSING].includes(p.status),
    );
    for (const payment of openPayments) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason =
        payment.failureReason || 'Checkout abandoned before payment completed';
    }
    if (openPayments.length) {
      await this.paymentRepo.save(openPayments);
    }

    return true;
  }
}
