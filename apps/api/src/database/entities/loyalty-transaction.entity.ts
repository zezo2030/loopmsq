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
import { Wallet } from './wallet.entity';
import { Booking } from './booking.entity';

export enum TransactionType {
  EARN = 'earn',
  BURN = 'burn',
  REFUND = 'refund',
  BONUS = 'bonus',
  PENALTY = 'penalty',
}

@Entity('loyalty_transactions')
@Index(['userId'])
@Index(['walletId'])
export class LoyaltyTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'int' })
  pointsChange: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amountChange: number;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'varchar', length: 255 })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  relatedBookingId: string;

  @Column({ type: 'json', nullable: true })
  metadata: {
    conversionRate?: number;
    promotionId?: string;
    expiresAt?: Date;
  };

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @ManyToOne(() => Booking, { nullable: true })
  @JoinColumn({ name: 'relatedBookingId' })
  relatedBooking: Booking;
}
