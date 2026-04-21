import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

  async completeRechargeFromPayment(
    userId: string,
    amount: number,
    paymentId: string,
    manager?: any,
    method: PaymentMethod = PaymentMethod.CREDIT_CARD,
  ) {
    const walletRepository = manager
      ? manager.getRepository(Wallet)
      : this.walletRepository;
    const transactionRepository = manager
      ? manager.getRepository(WalletTransaction)
      : this.transactionRepository;

    const wallet = await walletRepository.findOne({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const existingTransaction = await transactionRepository.findOne({
      where: {
        userId,
        reference: `payment_${paymentId}`,
      },
    });
    if (existingTransaction) {
      return {
        success: true,
        transactionId: existingTransaction.id,
        amount,
        newBalance: Number(wallet.balance),
      };
    }

    wallet.balance = Number(wallet.balance) + Number(amount);
    wallet.totalEarned = Number(wallet.totalEarned) + Number(amount);
    wallet.lastTransactionAt = new Date();
    await walletRepository.save(wallet);

    const transaction = transactionRepository.create({
      walletId: wallet.id,
      userId,
      type: WalletTransactionType.DEPOSIT,
      amount,
      status: WalletTransactionStatus.SUCCESS,
      method,
      reference: `payment_${paymentId}`,
      metadata: {
        flowType: 'wallet_recharge',
        paymentId,
      },
    });
    const savedTransaction = await transactionRepository.save(transaction);

    return {
      success: true,
      transactionId: savedTransaction.id,
      amount,
      newBalance: Number(wallet.balance),
    };
  }

  async creditWallet(
    userId: string,
    amount: number,
    link: {
      reference: string;
      method?: PaymentMethod;
      metadata?: Record<string, unknown>;
    },
    manager?: any,
  ) {
    const walletRepository = manager
      ? manager.getRepository(Wallet)
      : this.walletRepository;
    const transactionRepository = manager
      ? manager.getRepository(WalletTransaction)
      : this.transactionRepository;

    const wallet = await walletRepository.findOne({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const existingTransaction = await transactionRepository.findOne({
      where: {
        userId,
        reference: link.reference,
      },
    });
    if (existingTransaction) {
      return {
        success: true,
        transactionId: existingTransaction.id,
        amount,
        newBalance: Number(wallet.balance),
      };
    }

    wallet.balance = Number(wallet.balance) + Number(amount);
    wallet.totalEarned = Number(wallet.totalEarned) + Number(amount);
    wallet.lastTransactionAt = new Date();
    await walletRepository.save(wallet);

    const transaction = transactionRepository.create({
      walletId: wallet.id,
      userId,
      type: WalletTransactionType.DEPOSIT,
      amount,
      status: WalletTransactionStatus.SUCCESS,
      method: link.method ?? PaymentMethod.WALLET,
      reference: link.reference,
      metadata: link.metadata ?? {},
    });
    const savedTransaction = await transactionRepository.save(transaction);

    return {
      success: true,
      transactionId: savedTransaction.id,
      amount,
      newBalance: Number(wallet.balance),
    };
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

    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const balance = Number(wallet.balance);
    const deductAmount = Number(amount);

    if (balance < deductAmount) {
      const errorMsg = 'Insufficient wallet balance';
      this.logger.warn(
        `Wallet deduction failed: userId=${userId}, balance=${balance}, required=${deductAmount}`,
      );
      throw new BadRequestException(errorMsg);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
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
