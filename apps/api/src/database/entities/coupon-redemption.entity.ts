import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Coupon } from './coupon.entity';

/**
 * One row per successful coupon redemption. Backs per-user and global usage
 * limits and provides idempotency: a given (couponId, reference) is unique, so
 * re-running the same consumption (retry, webhook + confirm) never double-counts.
 */
@Entity('coupon_redemptions')
@Index(['couponId'])
@Index(['userId'])
@Index(['couponId', 'userId'])
@Index(['couponId', 'reference'], { unique: true })
export class CouponRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  couponId: string;

  @Column({ type: 'uuid' })
  userId: string;

  // Stable per-consumption key (e.g. the booking/purchase/payment id).
  @Column({ type: 'varchar', length: 255 })
  reference: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  orderAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Coupon)
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;
}
