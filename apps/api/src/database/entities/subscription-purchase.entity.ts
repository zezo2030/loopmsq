import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
  VersionColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Branch } from './branch.entity';
import { SubscriptionPlan } from './subscription-plan.entity';
import { SubscriptionUsageLog } from './subscription-usage-log.entity';
import { Payment } from './payment.entity';

export enum SubscriptionPurchaseStatus {
  /** Awaiting successful payment; not shown as a real subscription to the user. */
  PENDING_PAYMENT = 'pending_payment',
  ACTIVE = 'active',
  DEPLETED = 'depleted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum SubscriptionPurchasePaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('subscription_purchases')
@Index(['qrTokenHash'], { unique: true })
@Index(['userId', 'branchId', 'status'])
@Index(['branchId', 'status'])
export class SubscriptionPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'uuid' })
  subscriptionPlanId: string;

  @Column({ type: 'jsonb' })
  planSnapshot: any;

  @Column({ type: 'decimal', precision: 6, scale: 1, nullable: true })
  totalHours: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 1, nullable: true })
  remainingHours: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  dailyHoursLimit: number | null;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp' })
  endsAt: Date;

  @Column({
    type: 'enum',
    enum: SubscriptionPurchaseStatus,
    default: SubscriptionPurchaseStatus.ACTIVE,
  })
  status: SubscriptionPurchaseStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionPurchasePaymentStatus,
    default: SubscriptionPurchasePaymentStatus.PENDING,
  })
  paymentStatus: SubscriptionPurchasePaymentStatus;

  @Column({ type: 'varchar', length: 255, unique: true })
  qrTokenHash: string;

  @Column({ type: 'text', nullable: true })
  holderImageUrl: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  holderName: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => SubscriptionPlan, { nullable: true })
  @JoinColumn({ name: 'subscriptionPlanId' })
  subscriptionPlan: SubscriptionPlan;

  @OneToMany(() => SubscriptionUsageLog, (log) => log.subscriptionPurchase)
  usageLogs: SubscriptionUsageLog[];

  @OneToMany(() => Payment, (payment) => payment.subscriptionPurchase)
  payments: Payment[];
}
