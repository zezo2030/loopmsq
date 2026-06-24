import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Wallet } from '../../database/entities/wallet.entity';
import {
  WalletTransaction,
  WalletTransactionType,
  WalletTransactionStatus,
} from '../../database/entities/wallet-transaction.entity';
import { RechargeWalletDto } from './dto/recharge-wallet.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { ConfigService } from '@nestjs/config';
import { TapService } from '../../integrations/tap/tap.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../database/entities/payment.entity';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactionRepository: Repository<WalletTransaction>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly tapService?: TapService,
    private readonly notifications?: NotificationsService,
  ) {}

  async getWalletBalance(userId: string) {
    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return {
      balance: wallet.balance,
      currency: 'SAR',
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
    };
  }

  async getWalletTransactions(userId: string, query: ListTransactionsDto) {
    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const { type, status, page = 1, pageSize = 20 } = query;

    const walletTxQb = this.transactionRepository
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId });

    if (type) {
      walletTxQb.andWhere('tx.type = :type', { type });
    }
    if (status) {
      walletTxQb.andWhere('tx.status = :status', { status });
    }

    const [items, total] = await walletTxQb
      .orderBy('tx.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async createRechargeIntent(userId: string, dto: RechargeWalletDto) {
    const amount = Number(dto.amount);
    const method = dto.method;
    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (method === PaymentMethod.WALLET) {
      throw new BadRequestException('Wallet cannot be recharged using wallet');
    }
    if (method === PaymentMethod.CASH) {
      throw new BadRequestException(
        'Cash is not supported for wallet recharge',
      );
    }

    const existingPending = await this.paymentRepository.findOne({
      where: {
        status: PaymentStatus.PROCESSING,
        method,
      },
      order: { createdAt: 'DESC' },
    });

    if (
      existingPending &&
      existingPending.webhookData?.flowType === 'wallet_recharge' &&
      existingPending.webhookData?.userId === userId &&
      Number(existingPending.amount) === amount
    ) {
      return {
        paymentId: existingPending.id,
        chargeId: existingPending.gatewayRef || '',
        amount: Number(existingPending.amount),
        currency: existingPending.currency,
        status: existingPending.status,
      };
    }

    const payment = this.paymentRepository.create({
      amount,
      currency: 'SAR',
      status: PaymentStatus.PROCESSING,
      method,
      gatewayRef:
        !this.configService.get<string>('MOYASAR_SECRET_KEY') ||
        (this.configService.get<string>('PAYMENTS_BYPASS') || '').toString() ===
          'true'
          ? undefined
          : '',
      webhookData: {
        flowType: 'wallet_recharge',
        userId,
        walletId: wallet.id,
      },
    });

    const savedPayment = await this.paymentRepository.save(payment);
    const bypass =
      !this.configService.get<string>('MOYASAR_SECRET_KEY') ||
      (this.configService.get<string>('PAYMENTS_BYPASS') || '').toString() ===
        'true';

    if (bypass) {
      savedPayment.gatewayRef = `bypass_${savedPayment.id}`;
      await this.paymentRepository.save(savedPayment);
    }

    return {
      paymentId: savedPayment.id,
      chargeId: savedPayment.gatewayRef || '',
      amount: Number(savedPayment.amount),
      currency: savedPayment.currency,
      status: savedPayment.status,
    };
  }

  /**
   * Credit a wallet atomically. Locks the wallet row (pessimistic_write) so
   * concurrent credits/debits to the same wallet serialize, and is idempotent
   * per `reference` (a repeated credit returns the existing transaction instead
   * of crediting twice). Always runs inside a transaction — either the caller's
   * `manager`, or a fresh one we open.
   */
  private async applyCreditLocked(
    manager: EntityManager,
    userId: string,
    amount: number,
    reference: string,
    method: PaymentMethod,
    metadata: Record<string, unknown>,
  ) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new BadRequestException('Credit amount must be a positive number');
    }

    const walletRepository = manager.getRepository(Wallet);
    const transactionRepository = manager.getRepository(WalletTransaction);

    // Lock the wallet row for the duration of the transaction.
    const wallet = await walletRepository.findOne({
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const existingTransaction = await transactionRepository.findOne({
      where: { userId, reference },
    });
    if (existingTransaction) {
      return {
        success: true,
        transactionId: existingTransaction.id,
        amount: amt,
        newBalance: Number(wallet.balance),
      };
    }

    wallet.balance = Number(wallet.balance) + amt;
    wallet.totalEarned = Number(wallet.totalEarned) + amt;
    wallet.lastTransactionAt = new Date();
    await walletRepository.save(wallet);

    const transaction = transactionRepository.create({
      walletId: wallet.id,
      userId,
      type: WalletTransactionType.DEPOSIT,
      amount: amt,
      status: WalletTransactionStatus.SUCCESS,
      method,
      reference,
      metadata,
    });
    const savedTransaction = await transactionRepository.save(transaction);

    return {
      success: true,
      transactionId: savedTransaction.id,
      amount: amt,
      newBalance: Number(wallet.balance),
    };
  }

  async completeRechargeFromPayment(
    userId: string,
    amount: number,
    paymentId: string,
    manager?: EntityManager,
    method: PaymentMethod = PaymentMethod.CREDIT_CARD,
  ) {
    const reference = `payment_${paymentId}`;
    const metadata = { flowType: 'wallet_recharge', paymentId };
    if (manager) {
      return this.applyCreditLocked(
        manager,
        userId,
        amount,
        reference,
        method,
        metadata,
      );
    }
    return this.dataSource.transaction((m) =>
      this.applyCreditLocked(m, userId, amount, reference, method, metadata),
    );
  }

  async creditWallet(
    userId: string,
    amount: number,
    link: {
      reference: string;
      method?: PaymentMethod;
      metadata?: Record<string, unknown>;
    },
    manager?: EntityManager,
  ) {
    const method = link.method ?? PaymentMethod.WALLET;
    const metadata = link.metadata ?? {};
    if (manager) {
      return this.applyCreditLocked(
        manager,
        userId,
        amount,
        link.reference,
        method,
        metadata,
      );
    }
    return this.dataSource.transaction((m) =>
      this.applyCreditLocked(m, userId, amount, link.reference, method, metadata),
    );
  }

  /**
   * Deduct wallet balance. `relatedBookingId` must only be set when it exists in `bookings`
   * (FK). For event/trip flows use `metadata` + `reference` instead.
   */
  async deductWallet(
    userId: string,
    amount: number,
    link: {
      reference: string;
      relatedBookingId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    this.logger.log(
      `Deduct wallet: userId=${userId}, amount=${amount}, reference=${link.reference}, relatedBookingId=${link.relatedBookingId ?? 'none'}`,
    );

    const deductAmount = Number(amount);
    if (!Number.isFinite(deductAmount) || deductAmount <= 0) {
      throw new BadRequestException('Deduction amount must be a positive number');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock the wallet row so the balance check and the debit are atomic
      // against concurrent deductions (prevents double-spend / overdraft).
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const balance = Number(wallet.balance);
      if (balance < deductAmount) {
        this.logger.warn(
          `Wallet deduction failed: userId=${userId}, balance=${balance}, required=${deductAmount}`,
        );
        throw new BadRequestException('Insufficient wallet balance');
      }

      // Deduct from wallet
      wallet.balance = balance - deductAmount;
      wallet.totalSpent = Number(wallet.totalSpent) + deductAmount;
      wallet.lastTransactionAt = new Date();
      await queryRunner.manager.save(wallet);

      // Create transaction record
      const transaction = queryRunner.manager.create(WalletTransaction, {
        walletId: wallet.id,
        userId,
        type: WalletTransactionType.WITHDRAWAL,
        amount: deductAmount,
        status: WalletTransactionStatus.SUCCESS,
        ...(link.relatedBookingId
          ? { relatedBookingId: link.relatedBookingId }
          : {}),
        reference: link.reference,
        metadata: link.metadata ?? {},
      });

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Wallet deduction succeeded: userId=${userId}, amount=${deductAmount}, newBalance=${wallet.balance}`,
      );

      return {
        success: true,
        transactionId: transaction.id,
        amount: deductAmount,
        newBalance: wallet.balance,
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Wallet deduction transaction error: userId=${userId}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
