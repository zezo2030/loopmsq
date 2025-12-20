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
import { User } from './user.entity';
import { Wallet } from './wallet.entity';
import { Booking } from './booking.entity';

export enum WalletTransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

export enum WalletTransactionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

@Entity('wallet_transactions')
@Index(['walletId'])
@Index(['userId'])
@Index(['type'])
@Index(['status'])
@Index(['createdAt'])
@Index(['userId', 'type'])
@Index(['userId', 'status'])
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: WalletTransactionType })
  type: WalletTransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  method: string;

  @Column({ type: 'enum', enum: WalletTransactionStatus, default: WalletTransactionStatus.SUCCESS })
  status: WalletTransactionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string;

  @Column({ type: 'uuid', nullable: true })
  relatedBookingId: string;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @ManyToOne(() => Booking, { nullable: true })
  @JoinColumn({ name: 'relatedBookingId' })
  relatedBooking: Booking;
}
