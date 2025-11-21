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

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactionRepository: Repository<WalletTransaction>,
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

    const qb = this.transactionRepository
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId })
      .orderBy('tx.createdAt', 'DESC');

    if (type) {
      qb.andWhere('tx.type = :type', { type });
    }
    if (status) {
      qb.andWhere('tx.status = :status', { status });
    }

    const [items, total] = await qb
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

  async rechargeWallet(userId: string, dto: RechargeWalletDto) {
    const { amount, method } = dto;

    this.logger.log(`Recharge wallet request: userId=${userId}, amount=${amount}, method=${method}`);

    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create transaction record with status PENDING initially
      const transaction = queryRunner.manager.create(WalletTransaction, {
        walletId: wallet.id,
        userId,
        type: WalletTransactionType.DEPOSIT,
        amount,
        method,
        status: WalletTransactionStatus.FAILED,
        metadata: { rechargeAttempt: true },
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Bypass payments if keys are missing or explicitly enabled
      const bypass = !this.configService.get<string>('TAP_SECRET_KEY') ||
        (this.configService.get<string>('PAYMENTS_BYPASS') || '').toString() === 'true';

      let chargeResult: any = null;
      let success = false;
      let failureReason: string | null = null;

      if (bypass) {
        // Bypass mode: automatically succeed
        success = true;
        savedTransaction.reference = `bypass_${savedTransaction.id}`;
        savedTransaction.status = WalletTransactionStatus.SUCCESS;
        this.logger.log(`Bypass mode: Wallet recharge succeeded for userId=${userId}`);
      } else {
        // Process payment through gateway
        if (!this.tapService) {
          throw new BadRequestException('Payment gateway not configured');
        }

        try {
          const charge = await this.tapService.createCharge({
            amount: Number(amount),
            currency: 'SAR',
            capture: true,
            threeDS: 'required',
            source: { payment_method: method === 'credit_card' ? 'card' : 'card' },
            description: `Wallet recharge ${wallet.id}`,
            metadata: { walletId: wallet.id, transactionId: savedTransaction.id },
          });

          chargeResult = charge;
          const chargeStatus = charge.status?.toUpperCase();
          success = ['CAPTURED', 'AUTHORIZED', 'SUCCEEDED'].includes(chargeStatus || '');

          if (success) {
            savedTransaction.reference = charge.id;
            savedTransaction.status = WalletTransactionStatus.SUCCESS;
            this.logger.log(`Wallet recharge succeeded: userId=${userId}, chargeId=${charge.id}`);
          } else {
            failureReason = `Payment gateway returned status: ${chargeStatus}`;
            savedTransaction.failureReason = failureReason;
            savedTransaction.status = WalletTransactionStatus.FAILED;
            this.logger.warn(`Wallet recharge failed: userId=${userId}, reason=${failureReason}`);
          }
        } catch (error: any) {
          failureReason = error.message || 'Payment gateway error';
          savedTransaction.failureReason = failureReason;
          savedTransaction.status = WalletTransactionStatus.FAILED;
          this.logger.error(`Wallet recharge error: userId=${userId}, error=${failureReason}`, error.stack);
        }
      }

      // Update wallet if successful
      if (success) {
        wallet.balance = Number(wallet.balance) + Number(amount);
        wallet.totalEarned = Number(wallet.totalEarned) + Number(amount);
        wallet.lastTransactionAt = new Date();
        await queryRunner.manager.save(wallet);
      }

      // Update transaction
      savedTransaction.metadata = {
        ...savedTransaction.metadata,
        chargeResult,
      };
      await queryRunner.manager.save(savedTransaction);

      await queryRunner.commitTransaction();

      // Send notification if successful
      if (success && this.notifications) {
        await this.notifications.enqueue({
          type: 'WALLET_RECHARGED',
          to: { userId },
          data: { amount, balance: wallet.balance },
          channels: ['sms', 'push'],
        });
      }

      return {
        success,
        transactionId: savedTransaction.id,
        amount,
        newBalance: wallet.balance,
        failureReason,
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Wallet recharge transaction error: userId=${userId}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deductWallet(userId: string, amount: number, bookingId: string) {
    this.logger.log(`Deduct wallet: userId=${userId}, amount=${amount}, bookingId=${bookingId}`);

    const wallet = await this.walletRepository.findOne({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const balance = Number(wallet.balance);
    const deductAmount = Number(amount);

    if (balance < deductAmount) {
      const errorMsg = 'Insufficient wallet balance';
      this.logger.warn(`Wallet deduction failed: userId=${userId}, balance=${balance}, required=${deductAmount}`);
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
        relatedBookingId: bookingId,
        reference: `booking_${bookingId}`,
        metadata: { bookingId },
      });

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(`Wallet deduction succeeded: userId=${userId}, amount=${deductAmount}, newBalance=${wallet.balance}`);

      return {
        success: true,
        transactionId: transaction.id,
        amount: deductAmount,
        newBalance: wallet.balance,
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Wallet deduction transaction error: userId=${userId}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
