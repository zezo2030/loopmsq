import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Temporarily nullable to allow migration - will be enforced via validation
  @Column({ type: 'uuid', nullable: true })
  branchId: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({
    type: 'enum',
    enum: ['percentage', 'fixed'],
    default: 'percentage',
  })
  discountType: 'percentage' | 'fixed';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValue: number;

  // Optional cap on the discount a percentage coupon can grant (in currency).
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxDiscountAmount: number | null;

  // Total redemptions allowed across all users. null = unlimited.
  @Column({ type: 'int', nullable: true })
  usageLimit: number | null;

  // Redemptions allowed per user. null = unlimited.
  @Column({ type: 'int', nullable: true })
  perUserLimit: number | null;

  // Running count of successful redemptions (incremented atomically on redeem).
  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Branch, (branch) => branch.bookings)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
