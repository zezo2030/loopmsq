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

// المكافأة الثابتة: 20 ريال لكل دعوة ناجحة
// يتم منح المكافأة للداعي (referrer) عند موافقة الادمن على أول دفع للمستخدم المدعو (referee)
const REFERRAL_REWARD = 20; // fixed currency reward (SAR) to referrer upon approval

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
    const code = await this.codeRepo.findOne({ where: { code: dto.code, isActive: true } });
    if (!code) throw new NotFoundException('Invalid code');
    
    // منع المستخدم من استخدام كود دعوته الخاص
    if (code.userId === userId) throw new BadRequestException('Self-referral not allowed');
    
    // منع المستخدم من إدخال كود دعوة أكثر من مرة واحدة
    // كل مستخدم يمكنه إدخال كود دعوة مرة واحدة فقط (محمي على مستوى قاعدة البيانات أيضاً)
    const existing = await this.attrRepo.findOne({ where: { refereeId: userId } });
    if (existing) {
      throw new BadRequestException('You have already used a referral code. Each user can only use one referral code.');
    }
    
    // إنشاء attribution جديد
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
    // إنشاء مكافأة للداعي عند أول دفع للمستخدم المدعو
    // المكافأة: 20 ريال (REFERRAL_REWARD) - يتم منحها بعد موافقة الادمن
    const attr = await this.attrRepo.findOne({ where: { refereeId } });
    if (!attr) return { created: false };
    
    // التأكد من عدم إنشاء earning مكرر لنفس الدفع
    const existing = await this.earnRepo.findOne({ where: { refereeId, sourcePaymentId: paymentId } });
    if (existing) return { created: false };
    
    // إنشاء earning جديد بحالة PENDING (يحتاج موافقة الادمن)
    const earning = this.earnRepo.create({
      referrerId: attr.referrerId,
      refereeId,
      amount: REFERRAL_REWARD, // 20 ريال
      status: ReferralEarningStatus.PENDING,
      sourcePaymentId: paymentId,
    });
    await this.earnRepo.save(earning);
    return { created: true, earningId: earning.id };
  }
}


