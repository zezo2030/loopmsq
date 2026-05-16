import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
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

// نظام الإحالات: المكافأة عبارة عن نقاط ولاء تُمنح للداعي (referrer)
// فور قيام المستخدم المدعو (referee) بإدخال كود الإحالة — بدون انتظار دفع
// وبدون موافقة الادمن. عدد النقاط يُحدَّد من قاعدة الولاء النشطة عبر لوحة الأدمن
// (LoyaltyRule.referralRewardPoints).

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

    // إنشاء attribution جديد
    const attr = this.attrRepo.create({
      refereeId: userId,
      referrerId: code.userId,
      code: code.code,
    });
    await this.attrRepo.save(attr);

    // منح نقاط الولاء للداعي فوراً — عدد النقاط من قاعدة الولاء النشطة (لوحة الأدمن)
    const rule = await this.loyalty.getActiveRule();
    const rewardPoints = Number(rule.referralRewardPoints) || 0;
    let awardedPoints = 0;

    if (rewardPoints > 0) {
      try {
        const result = await this.loyalty.adjustWallet(code.userId, {
          pointsDelta: rewardPoints,
          reason: 'Referral reward',
        });
        awardedPoints = rewardPoints;

        // إشعار الداعي بحصوله على نقاط الإحالة
        try {
          await this.notifications.enqueue({
            type: 'REFERRAL_REWARD',
            to: { userId: code.userId },
            data: { points: rewardPoints, totalPoints: result.points },
            channels: ['sms', 'push'],
          });
        } catch (e) {
          this.logger.error(
            `Failed to notify referrer ${code.userId} of referral reward: ${e}`,
          );
        }
      } catch (e) {
        // لا نُفشل عملية الإحالة لو تعذّر منح النقاط — يُسجَّل الخطأ فقط
        this.logger.error(
          `Failed to credit ${rewardPoints} referral points to referrer ${code.userId}: ${e}`,
        );
      }
    }

    // تسجيل المكافأة كسجل دائم (يظهر في تبويب الأرباح بلوحة الأدمن)
    if (awardedPoints > 0) {
      const earning = this.earnRepo.create({
        referrerId: code.userId,
        refereeId: userId,
        amount: awardedPoints,
        status: ReferralEarningStatus.APPROVED,
      });
      await this.earnRepo.save(earning);
    }

    return {
      attributed: true,
      referrerId: code.userId,
      rewardPoints: awardedPoints,
    };
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
