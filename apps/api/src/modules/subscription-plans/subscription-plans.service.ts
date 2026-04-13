import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  SubscriptionPlan,
  SubscriptionUsageMode,
} from '../../database/entities/subscription-plan.entity';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  private readonly logger = new Logger(SubscriptionPlansService.name);

  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly repo: Repository<SubscriptionPlan>,
  ) {}

  /**
   * Find all active subscription plans for a branch.
   */
  async findActiveByBranch(
    branchId: string,
  ): Promise<{ plans: SubscriptionPlan[] }> {
    const now = new Date();

    const plans = await this.repo.find({
      where: [
        { branchId, isActive: true, startsAt: IsNull(), endsAt: IsNull() },
        {
          branchId,
          isActive: true,
          startsAt: LessThanOrEqual(now),
          endsAt: IsNull(),
        },
        {
          branchId,
          isActive: true,
          startsAt: IsNull(),
          endsAt: MoreThanOrEqual(now),
        },
        {
          branchId,
          isActive: true,
          startsAt: LessThanOrEqual(now),
          endsAt: MoreThanOrEqual(now),
        },
      ],
      order: { createdAt: 'DESC' },
    });

    return { plans };
  }

  async findById(id: string): Promise<SubscriptionPlan> {
    const plan = await this.repo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return plan;
  }

  private ensureHalfHour(value: number, field: string): void {
    if (value % 0.5 !== 0) {
      throw new BadRequestException(`${field} must be a multiple of 0.5`);
    }
  }

  private normalizePlanInput(dto: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = { ...dto };
    const usageMode = normalized.usageMode as SubscriptionUsageMode;
    const durationMonths = Number(normalized.durationMonths || 1);

    if (usageMode === SubscriptionUsageMode.DAILY_LIMITED) {
      const dailyHoursLimit = Number(normalized.dailyHoursLimit || 0);
      normalized.totalHours = dailyHoursLimit * durationMonths * 30;
    }

    if (usageMode === SubscriptionUsageMode.DAILY_UNLIMITED) {
      normalized.totalHours = null;
      normalized.dailyHoursLimit = null;
    }

    if (usageMode === SubscriptionUsageMode.FLEXIBLE_TOTAL_HOURS) {
      normalized.dailyHoursLimit = null;
    }

    normalized.mealItems =
      Array.isArray(normalized.mealItems) && normalized.mealItems.length > 0
        ? normalized.mealItems
            .map((item: unknown) => String(item).trim())
            .filter(Boolean)
        : null;

    return normalized;
  }

  private validatePlan(rawDto: any): void {
    const dto = this.normalizePlanInput(rawDto);

    if (!dto.usageMode) {
      throw new BadRequestException('usageMode is required');
    }

    if (dto.usageMode === SubscriptionUsageMode.FLEXIBLE_TOTAL_HOURS) {
      if (!dto.totalHours || dto.totalHours <= 0) {
        throw new BadRequestException('totalHours must be greater than 0');
      }

      this.ensureHalfHour(Number(dto.totalHours), 'totalHours');
    }

    if (dto.usageMode === SubscriptionUsageMode.DAILY_LIMITED) {
      if (!dto.dailyHoursLimit || dto.dailyHoursLimit <= 0) {
        throw new BadRequestException('dailyHoursLimit must be greater than 0');
      }

      this.ensureHalfHour(Number(dto.dailyHoursLimit), 'dailyHoursLimit');
      this.ensureHalfHour(Number(dto.totalHours), 'totalHours');
    }

    if (
      dto.startsAt &&
      dto.endsAt &&
      new Date(dto.startsAt) >= new Date(dto.endsAt)
    ) {
      throw new BadRequestException('startsAt must be before endsAt');
    }
  }

  async create(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    this.validatePlan(dto);
    const plan = this.repo.create(
      this.normalizePlanInput(dto) as Partial<SubscriptionPlan>,
    );
    return this.repo.save(plan);
  }

  async update(
    id: string,
    dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const plan = await this.findById(id);
    const merged = this.normalizePlanInput({ ...plan, ...dto });
    this.validatePlan(merged);
    Object.assign(plan, merged);
    return this.repo.save(plan);
  }

  async softDelete(id: string): Promise<SubscriptionPlan> {
    const plan = await this.findById(id);
    plan.isActive = false;
    return this.repo.save(plan);
  }

  async findAll(params: {
    branchId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    items: SubscriptionPlan[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { branchId, isActive, page = 1, limit = 20 } = params;
    const qb = this.repo.createQueryBuilder('plan');

    if (branchId) qb.andWhere('plan.branchId = :branchId', { branchId });
    if (isActive !== undefined)
      qb.andWhere('plan.isActive = :isActive', { isActive });

    qb.orderBy('plan.createdAt', 'DESC');

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit };
  }

  async uploadCoverImage(
    planId: string,
    filename: string,
  ): Promise<SubscriptionPlan> {
    const plan = await this.findById(planId);
    plan.imageUrl = `/uploads/subscription-plans/${filename}`;
    const updatedPlan = await this.repo.save(plan);
    this.logger.log(`Subscription plan cover image updated: ${planId}`);
    return updatedPlan;
  }
}
