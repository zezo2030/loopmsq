import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Branch } from './branch.entity';
import { SubscriptionPurchase } from './subscription-purchase.entity';

@Entity('subscription_usage_logs')
@Index(['subscriptionPurchaseId', 'createdAt'])
@Index(['staffId', 'createdAt'])
export class SubscriptionUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  subscriptionPurchaseId: string;

  @Column({ type: 'uuid' })
  staffId: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'decimal', precision: 4, scale: 1 })
  deductedHours: number;

  @Column({ type: 'decimal', precision: 6, scale: 1 })
  remainingHoursBefore: number;

  @Column({ type: 'decimal', precision: 6, scale: 1 })
  remainingHoursAfter: number;

  @Column({ type: 'decimal', precision: 4, scale: 1 })
  dailyUsedBefore: number;

  @Column({ type: 'decimal', precision: 4, scale: 1 })
  dailyUsedAfter: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => SubscriptionPurchase, (purchase) => purchase.usageLogs)
  @JoinColumn({ name: 'subscriptionPurchaseId' })
  subscriptionPurchase: SubscriptionPurchase;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'staffId' })
  staff: User;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
