import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import { ReferralCode } from '../../database/entities/referral-code.entity';
import { ReferralAttribution } from '../../database/entities/referral-attribution.entity';
import {
  ReferralEarning,
  ReferralEarningStatus,
} from '../../database/entities/referral-earning.entity';
import { AttributeReferralDto } from './dto/attribute.dto';
import { CreateReferralCodeDto } from './dto/create-code.dto';
import { ListCodesDto } from './dto/list-codes.dto';
import { ListEarningsDto } from './dto/list-earnings.dto';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationsService } from '../notifications/notifications.service';

// نظام الإحالات: المكافأة عبارة عن نقاط ولاء تُمنح للداعي (referrer) بعد قيام
// المستخدم المدعو (referee) بإتمام أول عملية دفع ناجحة — وليس بمجرد إدخال الكود.
// هذا يمنع استغلال النظام عبر حسابات وهمية. عدد النقاط يُحدَّد من قاعدة الولاء
// النشطة عبر لوحة الأدمن (LoyaltyRule.referralRewardPoints).

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectRepository(ReferralCode)
    private readonly codeRepo: Repository<ReferralCode>,
    @InjectRepository(ReferralAttribution)
    private readonly attrRepo: Repository<ReferralAttribution>,
    @InjectRepository(ReferralEarning)
    private readonly earnRepo: Repository<ReferralEarning>,
    private readonly loyalty: LoyaltyService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async createCode(dto: CreateReferralCodeDto) {
    const existing = await this.codeRepo.findOne({
      where: { userId: dto.userId },
    });
    const code =
      existing ??
      this.codeRepo.create({
        userId: dto.userId,
        code: await this.generateCode(),
      });
    if (dto.isActive != null) code.isActive = dto.isActive;
    return this.codeRepo.save(code);
  }

  private async generateCode(): Promise<string> {
    // Simple readable code: 8 chars A-Z0-9
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++)
      code += chars[Math.floor(Math.random() * chars.length)];
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

  async getMyCode(userId: string) {
    let code = await this.codeRepo.findOne({ where: { userId } });
    if (!code) {
      // Auto-create if doesn't exist
      code = this.codeRepo.create({ userId, code: await this.generateCode() });
      code = await this.codeRepo.save(code);
    }
    return { code: code.code, isActive: code.isActive };
  }

  async attribute(userId: string, dto: AttributeReferralDto) {
    // التحقق من صحة الكود
    const code = await this.codeRepo.findOne({
      where: { code: dto.code, isActive: true },
    });
    if (!code) throw new NotFoundException('Invalid code');

    // منع المستخدم من استخدام كود دعوته الخاص
    if (code.userId === userId)
      throw new BadRequestException('Self-referral not allowed');

    // منع المستخدم من إدخال كود دعوة أكثر من مرة واحدة
    // كل مستخدم يمكنه إدخال كود دعوة مرة واحدة فقط (محمي على مستوى قاعدة البيانات أيضاً)
    const existing = await this.attrRepo.findOne({
      where: { refereeId: userId },
    });
    if (existing) {
      throw new BadRequestException(
        'You have already used a referral code. Each user can only use one referral code.',
      );
    }

    // إنشاء attribution جديد — بدون منح أي نقاط الآن. المكافأة تُمنح للداعي
    // فقط بعد إتمام المدعو لأول عملية دفع ناجحة (processRefereePayment).
    const attr = this.attrRepo.create({
      refereeId: userId,
      referrerId: code.userId,
      code: code.code,
    });
    await this.attrRepo.save(attr);

    return {
      attributed: true,
      referrerId: code.userId,
      // المكافأة مؤجَّلة حتى أول عملية دفع — لذلك صفر الآن.
      rewardPoints: 0,
    };
  }

  /**
   * Award the referral reward to the referrer after the referee completes their
   * FIRST successful payment. Idempotent and concurrency-safe: locks the
   * referee's attribution row and refuses to award twice (one reward per
   * referee, ever). Never throws — referral rewards must not break payments.
   */
  async processRefereePayment(
    refereeId: string,
    sourcePaymentId?: string,
  ): Promise<void> {
    try {
      const rule = await this.loyalty.getActiveRule();
      const rewardPoints = Number(rule.referralRewardPoints) || 0;
      if (rewardPoints <= 0) return;

      const outcome = await this.dataSource.transaction(async (manager) => {
        const attrRepo = manager.getRepository(ReferralAttribution);
        const earnRepo = manager.getRepository(ReferralEarning);

        // Lock the attribution row so concurrent payments can't double-award.
        const attr = await attrRepo.findOne({
          where: { refereeId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!attr) return null;

        // Already rewarded? (one earning per referee, ever)
        const existing = await earnRepo.findOne({ where: { refereeId } });
        if (existing) return null;

        const earning = earnRepo.create({
          referrerId: attr.referrerId,
          refereeId,
          amount: rewardPoints,
          sourcePaymentId: sourcePaymentId ?? undefined,
          status: ReferralEarningStatus.APPROVED,
        });
        await earnRepo.save(earning);
        return { referrerId: attr.referrerId };
      });

      if (!outcome) return;

      // Credit loyalty points + notify outside the attribution transaction.
      const result = await this.loyalty.adjustWallet(outcome.referrerId, {
        pointsDelta: rewardPoints,
        reason: 'Referral reward',
      });
      try {
        await this.notifications.enqueue({
          type: 'REFERRAL_REWARD',
          to: { userId: outcome.referrerId },
          data: { points: rewardPoints, totalPoints: result.points },
          channels: ['sms', 'push'],
        });
      } catch (e) {
        this.logger.error(
          `Failed to notify referrer ${outcome.referrerId} of referral reward: ${e}`,
        );
      }
    } catch (e: any) {
      this.logger.error(
        `processRefereePayment failed for referee ${refereeId}: ${e?.message || e}`,
      );
    }
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
}
