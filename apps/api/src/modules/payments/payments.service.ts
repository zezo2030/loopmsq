import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
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
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../utils/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly notifications: NotificationsService,
    private readonly loyalty: LoyaltyService,
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

    // Idempotency by key
    const idempotencyKey = `pay:intent:${booking.id}:${dto.method}`;
    const exists = await this.redisService.get(idempotencyKey);
    if (exists) {
      return JSON.parse(exists);
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

      const savedPayment = await queryRunner.manager.save(payment);

      // Mock gateway: create session/secret
      const clientSecret = `mock_secret_${savedPayment.id}`;
      savedPayment.gatewayRef = clientSecret;
      savedPayment.status = PaymentStatus.PROCESSING;
      await queryRunner.manager.save(savedPayment);

      await queryRunner.commitTransaction();
      const response = {
        paymentId: savedPayment.id,
        clientSecret,
        amount: savedPayment.amount,
        currency: savedPayment.currency,
        status: savedPayment.status,
      };

      await this.redisService.set(idempotencyKey, response, 120);
      return response;
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
      // Notify payment success and booking confirmed
      await this.notifications.enqueue({
        type: 'PAYMENT_SUCCESS',
        to: { userId },
        data: { amount: payment.amount, currency: payment.currency },
        channels: ['sms', 'push'],
      });
      await this.notifications.enqueue({
        type: 'BOOKING_CONFIRMED',
        to: { userId },
        data: { bookingId: booking.id },
        channels: ['sms', 'push'],
      });
      // Award loyalty points
      await this.loyalty.awardPoints(userId, Number(payment.amount), booking.id);
      return { success: true, paymentId: payment.id };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async handleWebhook(dto: WebhookEventDto) {
    // Signature verification (mock but enforced via shared secret)
    const expectedSecret = this.configService.get<string>('PAYMENT_WEBHOOK_SECRET') || 'dev-webhook-secret';
    // In real gateway, you would compute signature from raw body + header secret
    const providedSecret = (dto as any).secret || dto.data?.secret;
    if (expectedSecret && providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (!dto.eventType || !dto.data?.paymentId) {
      throw new BadRequestException('Invalid webhook');
    }

    // Idempotency for webhook processing
    const idempotencyKey = `pay:webhook:${dto.eventType}:${dto.data.paymentId}`;
    const processed = await this.redisService.get(idempotencyKey);
    if (processed) {
      return { received: true, idempotent: true };
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

    await this.redisService.set(idempotencyKey, { ok: true }, 300);
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


