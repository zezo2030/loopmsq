import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminNotification } from '../../database/entities/admin-notification.entity';
import type {
  AdminNotificationSeverity,
  AdminNotificationType,
} from '../../database/entities/admin-notification.entity';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

export interface CreateAdminNotificationInput {
  type: AdminNotificationType;
  title: string;
  body: string;
  severity?: AdminNotificationSeverity;
  branchId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  data?: Record<string, unknown> | null;
}

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    @InjectRepository(AdminNotification)
    private readonly repo: Repository<AdminNotification>,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(input: CreateAdminNotificationInput): Promise<AdminNotification> {
    const entity = this.repo.create({
      type: input.type,
      title: input.title,
      body: input.body,
      severity: input.severity || 'info',
      branchId: input.branchId ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      data: input.data ?? null,
      isRead: false,
    });

    const saved = await this.repo.save(entity);

    // Fire-and-forget realtime emit. Never let WS failure abort callers.
    try {
      this.realtime.emitAdminNotification(saved);
    } catch (e) {
      this.logger.warn(`Failed to emit admin notification: ${String(e)}`);
    }

    return saved;
  }

  /**
   * Best-effort notify: never throws. Use from inside business flows so a
   * notification failure cannot abort the originating operation.
   */
  async notify(input: CreateAdminNotificationInput): Promise<void> {
    try {
      await this.create(input);
    } catch (e) {
      this.logger.warn(
        `notify(${input.type}) failed: ${(e as Error)?.message || e}`,
      );
    }
  }

  async list(opts: {
    page?: number;
    limit?: number;
    isRead?: boolean;
    branchId?: string;
    type?: AdminNotificationType;
  }) {
    const page = Math.max(opts.page || 1, 1);
    const limit = Math.min(Math.max(opts.limit || 20, 1), 100);

    const qb = this.repo
      .createQueryBuilder('n')
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (opts.isRead !== undefined) {
      qb.andWhere('n.isRead = :isRead', { isRead: opts.isRead });
    }
    if (opts.branchId) {
      qb.andWhere('(n.branchId = :branchId OR n.branchId IS NULL)', {
        branchId: opts.branchId,
      });
    }
    if (opts.type) {
      qb.andWhere('n.type = :type', { type: opts.type });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async unreadCount(branchId?: string): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.isRead = :isRead', { isRead: false });
    if (branchId) {
      qb.andWhere('(n.branchId = :branchId OR n.branchId IS NULL)', { branchId });
    }
    return qb.getCount();
  }

  async markRead(id: string): Promise<void> {
    await this.repo.update({ id }, { isRead: true, readAt: new Date() });
  }

  async markAllRead(branchId?: string): Promise<void> {
    const qb = this.repo
      .createQueryBuilder()
      .update(AdminNotification)
      .set({ isRead: true, readAt: new Date() })
      .where('isRead = :isRead', { isRead: false });
    if (branchId) {
      qb.andWhere('("branchId" = :branchId OR "branchId" IS NULL)', { branchId });
    }
    await qb.execute();
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
