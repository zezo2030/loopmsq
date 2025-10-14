import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ReferralCode } from '../../database/entities/referral-code.entity';
import { ReferralAttribution } from '../../database/entities/referral-attribution.entity';
import { ReferralEarning, ReferralEarningStatus } from '../../database/entities/referral-earning.entity';
import { AttributeReferralDto } from './dto/attribute.dto';
import { CreateReferralCodeDto } from './dto/create-code.dto';
import { ListCodesDto } from './dto/list-codes.dto';
import { ListEarningsDto } from './dto/list-earnings.dto';
import { ApproveEarningDto } from './dto/approve-earning.dto';
import { LoyaltyService } from '../loyalty/loyalty.service';

const REFERRAL_REWARD = 20; // fixed currency reward to referrer upon approval

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(ReferralCode) private readonly codeRepo: Repository<ReferralCode>,
    @InjectRepository(ReferralAttribution) private readonly attrRepo: Repository<ReferralAttribution>,
    @InjectRepository(ReferralEarning) private readonly earnRepo: Repository<ReferralEarning>,
    private readonly loyalty: LoyaltyService,
  ) {}

  async createCode(dto: CreateReferralCodeDto) {
    const existing = await this.codeRepo.findOne({ where: { userId: dto.userId } });
    const code = existing ?? this.codeRepo.create({ userId: dto.userId, code: await this.generateCode() });
    if (dto.isActive != null) code.isActive = dto.isActive;
    return this.codeRepo.save(code);
  }

  private async generateCode(): Promise<string> {
    // Simple readable code: 8 chars A-Z0-9
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const exists = await this.codeRepo.findOne({ where: { code } });
    return exists ? this.generateCode() : code;
  }

  async listCodes(dto: ListCodesDto) {
    const where: any = {};
    if (dto.userId) where.userId = dto.userId;
    if (dto.code) where.code = ILike(`%${dto.code}%`);
    if (dto.active != null) where.isActive = dto.active === 'true';
    const [items, total] = await this.codeRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' } as any,
      skip: ((dto.page || 1) - 1) * (dto.pageSize || 20),
      take: dto.pageSize || 20,
    });
    return { items, total, page: dto.page || 1, pageSize: dto.pageSize || 20 };
  }

  async attribute(userId: string, dto: AttributeReferralDto) {
    const code = await this.codeRepo.findOne({ where: { code: dto.code, isActive: true } });
    if (!code) throw new NotFoundException('Invalid code');
    if (code.userId === userId) throw new BadRequestException('Self-referral not allowed');
    const existing = await this.attrRepo.findOne({ where: { refereeId: userId } });
    if (existing) return { attributed: false, referrerId: existing.referrerId };
    const attr = this.attrRepo.create({ refereeId: userId, referrerId: code.userId, code: code.code });
    await this.attrRepo.save(attr);
    return { attributed: true, referrerId: code.userId };
  }

  async listEarnings(dto: ListEarningsDto) {
    const where: any = {};
    if (dto.status) where.status = dto.status;
    if (dto.referrerId) where.referrerId = dto.referrerId;
    const [items, total] = await this.earnRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' } as any,
      skip: ((dto.page || 1) - 1) * (dto.pageSize || 20),
      take: dto.pageSize || 20,
    });
    return { items, total, page: dto.page || 1, pageSize: dto.pageSize || 20 };
  }

  async approveEarning(id: string, _: ApproveEarningDto) {
    const earning = await this.earnRepo.findOne({ where: { id } });
    if (!earning) throw new NotFoundException('Earning not found');
    if (earning.status !== ReferralEarningStatus.PENDING) throw new BadRequestException('Not pending');
    earning.status = ReferralEarningStatus.APPROVED;
    await this.earnRepo.save(earning);
    // Credit referrer wallet as BONUS points equivalent (using loyalty adjust)
    await this.loyalty.adjustWallet(earning.referrerId, { balanceDelta: earning.amount, pointsDelta: 0, reason: 'Referral reward' });
    return { success: true };
  }

  async createEarningForFirstPayment(refereeId: string, paymentId: string) {
    // If referee is attributed and has no previous approved/created earning from payments, create pending
    const attr = await this.attrRepo.findOne({ where: { refereeId } });
    if (!attr) return { created: false };
    const existing = await this.earnRepo.findOne({ where: { refereeId, sourcePaymentId: paymentId } });
    if (existing) return { created: false };
    const earning = this.earnRepo.create({
      referrerId: attr.referrerId,
      refereeId,
      amount: REFERRAL_REWARD,
      status: ReferralEarningStatus.PENDING,
      sourcePaymentId: paymentId,
    });
    await this.earnRepo.save(earning);
    return { created: true, earningId: earning.id };
  }
}


