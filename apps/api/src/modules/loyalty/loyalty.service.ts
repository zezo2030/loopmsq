import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LoyaltyRule } from '../../database/entities/loyalty-rule.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../../database/entities/wallet-transaction.entity';
import {
  LoyaltyTransaction,
  TransactionType,
} from '../../database/entities/loyalty-transaction.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { Branch } from '../../database/entities/branch.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    @InjectRepository(LoyaltyRule)
    private readonly ruleRepo: Repository<LoyaltyRule>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(LoyaltyTransaction)
    private readonly txRepo: Repository<LoyaltyTransaction>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    private readonly notifications: NotificationsService,
    private readonly qrCodeService: QRCodeService,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  async getActiveRule(): Promise<LoyaltyRule> {
    let rule = await this.ruleRepo.findOne({ where: { isActive: true } });
    if (!rule) {
      rule = this.ruleRepo.create({
        earnRate: 1,
        pointsPerTicket: 500,
        isActive: true,
      });
      rule = await this.ruleRepo.save(rule);
    }
    return rule;
  }

  async getSummary(userId: string) {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const txs = await this.txRepo.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' } as any,
    });
    const rule = await this.getActiveRule();

    return {
      points: wallet.loyaltyPoints,
      pointsPerTicket: rule.pointsPerTicket,
      transactions: txs,
    };
  }

  async awardPoints(userId: string, amount: number, relatedBookingId?: string) {
    const rule = await this.getActiveRule();
    const points = Math.floor(amount * Number(rule.earnRate));
    if (points <= 0) return { awarded: 0 };

    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    wallet.loyaltyPoints += points;
    wallet.totalEarned = Number(wallet.totalEarned) + Number(amount);
    wallet.lastTransactionAt = new Date();
    await this.walletRepo.save(wallet);

    const tx = this.txRepo.create({
      userId,
      walletId: wallet.id,
      pointsChange: points,
      amountChange: amount,
      type: TransactionType.EARN,
      reason: 'Payment completed',
      relatedBookingId,
      metadata: { conversionRate: Number(rule.earnRate) },
    });
    await this.txRepo.save(tx);

    await this.notifications.enqueue({
      type: 'LOYALTY_EARN',
      to: { userId },
      data: { points, totalPoints: wallet.loyaltyPoints },
      channels: ['sms', 'push'],
    });

    return { awarded: points };
  }

  async redeemForTicket(userId: string, branchId: string) {
    const rule = await this.getActiveRule();
    const pointsPerTicket = rule.pointsPerTicket;

    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.loyaltyPoints < pointsPerTicket) {
      throw new BadRequestException(
        `Insufficient points. You need ${pointsPerTicket} points but have ${wallet.loyaltyPoints}.`,
      );
    }

    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      wallet.loyaltyPoints -= pointsPerTicket;
      wallet.lastTransactionAt = new Date();
      await queryRunner.manager.save(wallet);

      const now = new Date();
      const booking = queryRunner.manager.create(Booking, {
        userId,
        branchId,
        startTime: now,
        durationHours: 24,
        persons: 1,
        totalPrice: 0 as any,
        status: BookingStatus.CONFIRMED,
        specialRequests: 'Loyalty reward ticket',
        metadata: {
          isLoyaltyTicket: true,
          loyaltyType: 'open_day',
        },
      } as Partial<Booking>);

      const savedBooking = await queryRunner.manager.save(booking);

      const qrToken = this.qrCodeService.generateQRToken(
        savedBooking.id,
        `${savedBooking.id}-loyalty-0`,
      );
      const qrTokenHash = this.qrCodeService.generateQRTokenHash(qrToken);

      const ticket = queryRunner.manager.create(Ticket, {
        bookingId: savedBooking.id,
        qrTokenHash,
        status: TicketStatus.VALID,
        personCount: 1,
        validFrom: null,
        validUntil: null,
        metadata: {
          isLoyaltyTicket: true,
          notes: 'Open-day loyalty ticket',
        },
      });
      const savedTicket = await queryRunner.manager.save(ticket);

      const tx = this.txRepo.create({
        userId,
        walletId: wallet.id,
        pointsChange: -pointsPerTicket,
        amountChange: 0,
        type: TransactionType.REDEEM_TICKET,
        reason: `Redeemed for free ticket at branch ${branchId}`,
        relatedBookingId: savedBooking.id,
        relatedTicketId: savedTicket.id,
        metadata: {
          ticketId: savedTicket.id,
          branchId,
        },
      });
      await queryRunner.manager.save(tx);

      await queryRunner.commitTransaction();

      await this.redisService.invalidateUserBookingsListCache(userId);

      const branchName = branch.name_ar || branch.name_en || branch.id;
      await this.notifications.enqueue({
        type: 'LOYALTY_TICKET_REDEEMED',
        to: { userId },
        data: {
          pointsRedeemed: pointsPerTicket,
          bookingId: savedBooking.id,
          branchId,
          branchName,
          totalPoints: wallet.loyaltyPoints,
        },
        channels: ['sms', 'push'],
      });

      this.logger.log(
        `Loyalty ticket redeemed: booking ${savedBooking.id}, ticket ${savedTicket.id} for user ${userId}`,
      );

      return {
        redeemed: pointsPerTicket,
        remainingPoints: wallet.loyaltyPoints,
        branchName,
        booking: savedBooking,
        ticket: savedTicket,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async listRules(): Promise<LoyaltyRule[]> {
    return this.ruleRepo.find({ order: { createdAt: 'DESC' } as any });
  }

  async createRule(input: Partial<LoyaltyRule>): Promise<LoyaltyRule> {
    const rule = this.ruleRepo.create({
      earnRate: input.earnRate ?? 1,
      pointsPerTicket: input.pointsPerTicket ?? 500,
      isActive: input.isActive ?? true,
    });
    if (rule.isActive) {
      await this.ruleRepo.update(
        { isActive: true } as any,
        { isActive: false } as any,
      );
    }
    return this.ruleRepo.save(rule);
  }

  async setActiveRule(id: string): Promise<void> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    await this.ruleRepo.update(
      { isActive: true } as any,
      { isActive: false } as any,
    );
    rule.isActive = true;
    await this.ruleRepo.save(rule);
  }

  async updateRule(
    id: string,
    input: Partial<LoyaltyRule>,
  ): Promise<LoyaltyRule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');

    if (input.earnRate !== undefined) rule.earnRate = input.earnRate;
    if (input.pointsPerTicket !== undefined) {
      rule.pointsPerTicket = input.pointsPerTicket;
    }
    if (input.isActive !== undefined) {
      if (input.isActive && !rule.isActive) {
        await this.ruleRepo.update(
          { isActive: true } as any,
          { isActive: false } as any,
        );
      }
      rule.isActive = input.isActive;
    }

    return this.ruleRepo.save(rule);
  }

  async listWallets(params: {
    query?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { query, page = 1, pageSize = 20 } = params;
    const qb = this.walletRepo
      .createQueryBuilder('w')
      .leftJoinAndSelect('w.user', 'u')
      .orderBy('w.updatedAt', 'DESC');

    if (query && query.trim()) {
      const q = query.trim();
      const isUuid =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          q,
        );
      if (isUuid) {
        qb.andWhere('w.userId = :uid', { uid: q });
      } else {
        qb.andWhere('u.name ILIKE :q', { q: `%${q}%` });
      }
    }

    try {
      const [items, total] = await qb
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

      return { items, total, page, pageSize };
    } catch (e: any) {
      if (e?.code === '22P02') {
        return { items: [], total: 0, page, pageSize };
      }
      throw e;
    }
  }

  async adjustWallet(
    userId: string,
    input: { balanceDelta?: number; pointsDelta?: number; reason?: string },
  ) {
    if (!input || (input.balanceDelta == null && input.pointsDelta == null)) {
      throw new BadRequestException('No changes provided');
    }

    const balanceDelta =
      input.balanceDelta != null && Number(input.balanceDelta) !== 0
        ? Number(input.balanceDelta)
        : 0;
    const pointsDelta =
      input.pointsDelta != null && Number(input.pointsDelta) !== 0
        ? Number(input.pointsDelta)
        : 0;

    if (balanceDelta === 0 && pointsDelta === 0) {
      throw new BadRequestException('No changes provided');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const wallet = await queryRunner.manager.findOne(Wallet, {
        where: { userId },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const currentBalance = Number(wallet.balance);
      const newBalance = currentBalance + balanceDelta;
      if (newBalance < 0) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      if (balanceDelta !== 0) {
        wallet.balance = newBalance;
        if (balanceDelta > 0) {
          wallet.totalEarned = Number(wallet.totalEarned) + balanceDelta;
        } else {
          wallet.totalSpent =
            Number(wallet.totalSpent) + Math.abs(balanceDelta);
        }
      }

      if (pointsDelta !== 0) {
        wallet.loyaltyPoints = Number(wallet.loyaltyPoints) + pointsDelta;
      }

      if (balanceDelta !== 0 || pointsDelta !== 0) {
        wallet.lastTransactionAt = new Date();
      }

      await queryRunner.manager.save(wallet);

      if (balanceDelta !== 0) {
        const walletTx = queryRunner.manager.create(WalletTransaction, {
          walletId: wallet.id,
          userId,
          type:
            balanceDelta > 0
              ? WalletTransactionType.DEPOSIT
              : WalletTransactionType.WITHDRAWAL,
          amount: Math.abs(balanceDelta),
          status: WalletTransactionStatus.SUCCESS,
          method: balanceDelta > 0 ? 'reward' : 'admin_adjustment',
          reference: `admin_adjust:${randomUUID()}`,
          metadata: {
            source: 'admin_adjust',
            reason: input.reason ?? null,
          },
        });
        await queryRunner.manager.save(walletTx);
      }

      if (pointsDelta !== 0) {
        const loyaltyTx = queryRunner.manager.create(LoyaltyTransaction, {
          userId,
          walletId: wallet.id,
          pointsChange: pointsDelta,
          amountChange: null,
          type:
            pointsDelta > 0 ? TransactionType.BONUS : TransactionType.PENALTY,
          reason: input.reason || 'Admin adjustment',
        } as any);
        await queryRunner.manager.save(loyaltyTx);
      }

      await queryRunner.commitTransaction();

      if (balanceDelta > 0) {
        await this.notifications.enqueue({
          type: 'WALLET_REWARD_CREDITED',
          to: { userId },
          data: {
            amount: balanceDelta,
            currency: 'SAR',
            balance: Number(wallet.balance),
            reason: input.reason,
          },
          channels: ['sms', 'push'],
        });
      }

      return {
        success: true,
        balance: wallet.balance,
        points: wallet.loyaltyPoints,
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }
}
