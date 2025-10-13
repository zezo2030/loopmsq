import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../database/entities/payment.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { CreatePaymentIntentDto } from './dto/create-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { RefundDto } from './dto/refund.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly dataSource: DataSource,
  ) {}

  async createIntent(userId: string, dto: CreatePaymentIntentDto) {
    const booking = await this.bookingRepository.findOne({
      where: { id: dto.bookingId, userId },
      relations: ['payments'],
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.PENDING)
      throw new BadRequestException('Booking not payable');

    // Idempotency: return existing pending/processing intent for same method
    const existing = booking.payments?.find(
      (p) =>
        (p.status === PaymentStatus.PENDING ||
          p.status === PaymentStatus.PROCESSING) &&
        p.method === dto.method,
    );
    if (existing) {
      return {
        paymentId: existing.id,
        clientSecret: existing.gatewayRef,
        amount: existing.amount,
        currency: existing.currency,
        status: existing.status,
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payment = queryRunner.manager.create(Payment, {
        bookingId: booking.id,
        amount: booking.totalPrice,
        currency: 'SAR',
        status: PaymentStatus.PENDING,
        method: dto.method,
      });

      const saved = await queryRunner.manager.save(payment);

      // Mock gateway: create session/secret
      const clientSecret = `mock_secret_${saved.id}`;
      saved.gatewayRef = clientSecret;
      saved.status = PaymentStatus.PROCESSING;
      await queryRunner.manager.save(saved);

      await queryRunner.commitTransaction();

      return {
        paymentId: saved.id,
        clientSecret,
        amount: saved.amount,
        currency: saved.currency,
        status: saved.status,
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async confirmPayment(userId: string, dto: ConfirmPaymentDto) {
    const booking = await this.bookingRepository.findOne({
      where: { id: dto.bookingId, userId },
      relations: ['payments'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const payment = booking.payments.find((p) => p.id === dto.paymentId);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.COMPLETED)
      return { success: true, paymentId: payment.id };

    // Mock verify gateway payload
    if (!dto.gatewayPayload || dto.gatewayPayload.clientSecret !== payment.gatewayRef) {
      throw new BadRequestException('Invalid gateway payload');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      payment.status = PaymentStatus.COMPLETED;
      payment.paidAt = new Date();
      payment.transactionId = `txn_${payment.id}`;
      await queryRunner.manager.save(payment);

      booking.status = BookingStatus.CONFIRMED;
      await queryRunner.manager.save(booking);

      await queryRunner.commitTransaction();
      return { success: true, paymentId: payment.id };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async handleWebhook(dto: WebhookEventDto) {
    // Mock signature verification and idempotency key
    if (!dto.eventType || !dto.data?.paymentId) {
      throw new BadRequestException('Invalid webhook');
    }

    const payment = await this.paymentRepository.findOne({
      where: { id: dto.data.paymentId },
      relations: ['booking'],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    if (dto.eventType === 'payment.succeeded') {
      if (payment.status !== PaymentStatus.COMPLETED) {
        payment.status = PaymentStatus.COMPLETED;
        payment.paidAt = new Date();
        await this.paymentRepository.save(payment);
        if (payment.booking && payment.booking.status !== BookingStatus.CONFIRMED) {
          payment.booking.status = BookingStatus.CONFIRMED;
          await this.bookingRepository.save(payment.booking);
        }
      }
    }

    return { received: true };
  }

  async refundPayment(dto: RefundDto) {
    const payment = await this.paymentRepository.findOne({
      where: { id: dto.paymentId },
      relations: ['booking'],
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.COMPLETED)
      throw new BadRequestException('Only completed payments can be refunded');

    const amountToRefund = dto.amount ?? payment.amount;
    if (amountToRefund <= 0 || amountToRefund > payment.amount)
      throw new BadRequestException('Invalid refund amount');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      payment.refundedAmount = (payment.refundedAmount || 0) + amountToRefund;
      payment.refundedAt = new Date();
      payment.status =
        payment.refundedAmount >= payment.amount
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
      await queryRunner.manager.save(payment);

      // Optional: mark booking cancelled on full refund
      if (
        payment.booking &&
        payment.refundedAmount >= payment.amount &&
        payment.booking.status === BookingStatus.CONFIRMED
      ) {
        payment.booking.status = BookingStatus.CANCELLED;
        await queryRunner.manager.save(payment.booking);
      }

      await queryRunner.commitTransaction();
      return { success: true, status: payment.status };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async getPaymentById(userId: string, id: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['booking'],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // Owner or admin/ staff guarded at controller for other routes; here enforce owner check
    if (payment.booking?.userId !== userId) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }
}


