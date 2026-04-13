import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Branch } from './branch.entity';

export enum SubscriptionDurationType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM_MONTHS = 'custom_months',
}

export enum SubscriptionUsageMode {
  FLEXIBLE_TOTAL_HOURS = 'flexible_total_hours',
  DAILY_LIMITED = 'daily_limited',
  DAILY_UNLIMITED = 'daily_unlimited',
}

@Entity('subscription_plans')
@Index(['branchId', 'isActive', 'createdAt'])
export class SubscriptionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  imageUrl: string;

  @Column({ type: 'text', nullable: true })
  termsAndConditions: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 3, default: 'SAR' })
  currency: string;

  @Column({
    type: 'enum',
    enum: SubscriptionUsageMode,
    default: SubscriptionUsageMode.DAILY_LIMITED,
  })
  usageMode: SubscriptionUsageMode;

  @Column({ type: 'decimal', precision: 6, scale: 1, nullable: true })
  totalHours: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  dailyHoursLimit: number | null;

  @Column({ type: 'simple-array', nullable: true })
  mealItems: string[] | null;

  @Column({ type: 'enum', enum: SubscriptionDurationType })
  durationType: SubscriptionDurationType;

  @Column({ type: 'int' })
  durationMonths: number;

  @Column({ type: 'boolean', default: false })
  isGiftable: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
