import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Branch } from './branch.entity';
import { User } from './user.entity';
import { Payment } from './payment.entity';

export enum GiftType {
  OFFER = 'offer',
  SUBSCRIPTION = 'subscription',
}

export enum GiftPaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum GiftStatus {
  PENDING_CLAIM = 'pending_claim',
  CLAIMED = 'claimed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum GiftRefundRequestStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum FinalAssetType {
  OFFER_BOOKING = 'offer_booking',
  SUBSCRIPTION_PURCHASE = 'subscription_purchase',
}

export enum WhatsAppStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

@Entity('gift_orders')
@Index('idx_gift_orders_normalized_phone', ['normalizedRecipientPhone'])
@Index('idx_gift_orders_sender', ['senderUserId'])
@Index('idx_gift_orders_status', ['giftStatus'])
@Index('idx_gift_orders_payment_status', ['paymentStatus'])
@Index('idx_gift_orders_refund_request_status', ['refundRequestStatus'])
@Index('idx_gift_orders_claim_token', ['claimTokenHash'], { unique: true })
@Index('idx_gift_orders_expiry', ['giftStatus', 'claimTokenExpiresAt'])
export class GiftOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: GiftType })
  giftType: GiftType;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'uuid' })
  senderUserId: string;

  @Column({ type: 'varchar', length: 255 })
  recipientPhone: string;

  @Column({ type: 'varchar', length: 20 })
  normalizedRecipientPhone: string;

  @Column({ type: 'boolean', default: false })
  showSenderInfo: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  senderDisplayNameSnapshot: string;

  @Column({ type: 'text', nullable: true })
  giftMessage: string;

  @Column({ type: 'uuid' })
  sourceProductId: string;

  @Column({ type: 'jsonb' })
  sourceProductSnapshot: Record<string, any>;

  @Column({ type: 'varchar', length: 3, default: 'SAR' })
  currency: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  tax: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({
    type: 'enum',
    enum: GiftPaymentStatus,
    default: GiftPaymentStatus.PENDING,
  })
  paymentStatus: GiftPaymentStatus;

  @Column({ type: 'enum', enum: GiftStatus, default: GiftStatus.PENDING_CLAIM })
  giftStatus: GiftStatus;

  @Column({
    type: 'enum',
    enum: GiftRefundRequestStatus,
    default: GiftRefundRequestStatus.NONE,
  })
  refundRequestStatus: GiftRefundRequestStatus;

  @Column({ type: 'timestamp', nullable: true })
  refundRequestedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  refundRequestedByUserId: string | null;

  @Column({ type: 'text', nullable: true })
  refundRequestReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  refundReviewedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  refundReviewedByUserId: string | null;

  @Column({ type: 'text', nullable: true })
  refundReviewNote: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refundWalletReference: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  claimTokenHash: string;

  @Column({ type: 'timestamp', nullable: true })
  claimTokenExpiresAt: Date;

  @Column({ type: 'uuid', nullable: true })
  claimedByUserId: string;

  @Column({ type: 'timestamp', nullable: true })
  claimedAt: Date;

  @Column({ type: 'enum', enum: FinalAssetType, nullable: true })
  finalAssetType: FinalAssetType;

  @Column({ type: 'uuid', nullable: true })
  finalAssetId: string;

  @Column({
    type: 'enum',
    enum: WhatsAppStatus,
    default: WhatsAppStatus.PENDING,
  })
  whatsappMessageStatus: WhatsAppStatus;

  @Column({ type: 'timestamp', nullable: true })
  whatsappSentAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'senderUserId' })
  senderUser: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'claimedByUserId' })
  claimedByUser: User;

  @OneToMany(() => Payment, (payment) => payment.giftOrder)
  payments: Payment[];
}
