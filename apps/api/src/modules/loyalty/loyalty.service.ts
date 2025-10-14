import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { LoyaltyRule } from '../../database/entities/loyalty-rule.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { LoyaltyTransaction, TransactionType } from '../../database/entities/loyalty-transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyRule) private readonly ruleRepo: Repository<LoyaltyRule>,
    @InjectRepository(Wallet) private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(LoyaltyTransaction) private readonly txRepo: Repository<LoyaltyTransaction>,
    private readonly notifications: NotificationsService,
  ) {}

  async getActiveRule(): Promise<LoyaltyRule> {
    let rule = await this.ruleRepo.findOne({ where: { isActive: true } });
    if (!rule) {
      rule = this.ruleRepo.create({ earnRate: 1, redeemRate: 0.05, minRedeemPoints: 0, isActive: true });
      rule = await this.ruleRepo.save(rule);
    }
    return rule;
  }

  async getSummary(userId: string) {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const txs = await this.txRepo.find({ where: { walletId: wallet.id }, order: { createdAt: 'DESC' } as any });
    return { balance: wallet.balance, points: wallet.loyaltyPoints, transactions: txs };
  }

  async awardPoints(userId: string, amount: number, relatedBookingId?: string) {
    const rule = await this.getActiveRule();
    const points = Math.floor(amount * Number(rule.earnRate));
    if (points <= 0) return { awarded: 0 };
    let wallet = await this.walletRepo.findOne({ where: { userId } });
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

  async redeemPoints(userId: string, points: number) {
    if (points <= 0) throw new BadRequestException('Invalid points');
    const rule = await this.getActiveRule();
    if (points < rule.minRedeemPoints) throw new BadRequestException('Below minimum redeem points');
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.loyaltyPoints < points) throw new BadRequestException('Insufficient points');
    const value = points * Number(rule.redeemRate);
    wallet.loyaltyPoints -= points;
    wallet.balance = Number(wallet.balance) + value;
    wallet.lastTransactionAt = new Date();
    await this.walletRepo.save(wallet);
    const tx = this.txRepo.create({
      userId,
      walletId: wallet.id,
      pointsChange: -points,
      amountChange: value,
      type: TransactionType.BURN,
      reason: 'Redeem points',
      metadata: { conversionRate: Number(rule.redeemRate) },
    });
    await this.txRepo.save(tx);
    await this.notifications.enqueue({
      type: 'LOYALTY_REDEEM',
      to: { userId },
      data: { points, credit: value, totalPoints: wallet.loyaltyPoints },
      channels: ['sms', 'push'],
    });
    return { redeemed: points, credit: value };
  }

  // Admin APIs
  async listRules(): Promise<LoyaltyRule[]> {
    return this.ruleRepo.find({ order: { createdAt: 'DESC' } as any });
  }

  async createRule(input: Partial<LoyaltyRule>): Promise<LoyaltyRule> {
    const rule = this.ruleRepo.create({
      earnRate: input.earnRate ?? 1,
      redeemRate: input.redeemRate ?? 0.05,
      minRedeemPoints: input.minRedeemPoints ?? 0,
      isActive: input.isActive ?? true,
    });
    if (rule.isActive) {
      await this.ruleRepo.update({ isActive: true } as any, { isActive: false } as any);
    }
    return this.ruleRepo.save(rule);
  }

  async setActiveRule(id: string): Promise<void> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    await this.ruleRepo.update({ isActive: true } as any, { isActive: false } as any);
    rule.isActive = true;
    await this.ruleRepo.save(rule);
  }

  async listWallets(params: { query?: string; page?: number; pageSize?: number }) {
    const { query, page = 1, pageSize = 20 } = params;
    const where = query
      ? [
          { user: { name: ILike(`%${query}%`) } } as any,
          { userId: ILike(`%${query}%`) } as any,
        ]
      : undefined;

    const [items, total] = await this.walletRepo.findAndCount({
      relations: ['user'],
      where: where as any,
      order: { updatedAt: 'DESC' } as any,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total, page, pageSize };
  }

  async adjustWallet(userId: string, input: { balanceDelta?: number; pointsDelta?: number; reason?: string }) {
    if (!input || (input.balanceDelta == null && input.pointsDelta == null)) {
      throw new BadRequestException('No changes provided');
    }
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    if (input.balanceDelta) {
      wallet.balance = Number(wallet.balance) + Number(input.balanceDelta);
    }
    if (input.pointsDelta) {
      wallet.loyaltyPoints = Number(wallet.loyaltyPoints) + Number(input.pointsDelta);
    }
    wallet.lastTransactionAt = new Date();
    await this.walletRepo.save(wallet);

    if (input.pointsDelta && input.pointsDelta !== 0) {
      const tx = this.txRepo.create({
        userId,
        walletId: wallet.id,
        pointsChange: Number(input.pointsDelta),
        amountChange: null,
        type: input.pointsDelta > 0 ? TransactionType.BONUS : TransactionType.PENALTY,
        reason: input.reason || 'Admin adjustment',
      } as any);
      await this.txRepo.save(tx);
    }

    return { success: true, balance: wallet.balance, points: wallet.loyaltyPoints };
  }
}


