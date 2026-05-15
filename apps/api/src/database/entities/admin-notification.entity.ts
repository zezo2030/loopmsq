import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AdminNotificationType =
  | 'BOOKING_CREATED'
  | 'BOOKING_CANCELLED'
  | 'OFFER_PURCHASED'
  | 'OFFER_TICKET_SCANNED'
  | 'SUBSCRIPTION_PURCHASED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'TRIP_REQUEST_CREATED'
  | 'EVENT_REQUEST_CREATED'
  | 'SUPPORT_TICKET_CREATED'
  | 'REVIEW_NEGATIVE'
  | 'ADDON_CREATED'
  | 'ADDON_DELETED'
  | 'OFFER_CREATED'
  | 'OFFER_DELETED'
  | 'OFFER_PRODUCT_CREATED'
  | 'OFFER_PRODUCT_DELETED'
  | 'COUPON_CREATED'
  | 'COUPON_DELETED'
  | 'BANNER_CREATED'
  | 'BANNER_DELETED'
  | 'SUBSCRIPTION_PLAN_CREATED'
  | 'SUBSCRIPTION_PLAN_DELETED';

export type AdminNotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

@Entity('admin_notifications')
export class AdminNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  type: AdminNotificationType;

  @Column({ type: 'varchar', length: 20, default: 'info' })
  severity: AdminNotificationSeverity;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  // Optional branch scope so branch managers see only their own.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  branchId?: string | null;

  // Loose link to the originating record (booking, offer, ticket, payment...).
  @Column({ type: 'varchar', length: 50, nullable: true })
  resourceType?: string | null;

  @Column({ type: 'uuid', nullable: true })
  resourceId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, unknown> | null;

  @Index()
  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
