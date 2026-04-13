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
import { PaymentMethod } from './payment.entity';

export enum EventRequestStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  QUOTED = 'quoted',
  INVOICED = 'invoiced',
  DEPOSIT_PAID = 'deposit_paid',
  PAID = 'paid',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

@Entity('event_requests')
@Index(['requesterId'])
@Index(['status'])
@Index(['branchId', 'status', 'startTime'])
export class EventRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  requesterId: string;

  @Column({ type: 'varchar', length: 50 })
  type: string; // birthday, graduation, family, ...

  @Column({ type: 'boolean', default: false })
  decorated: boolean;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'uuid', nullable: true })
  bookingId: string | null;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'int', default: 2 })
  durationHours: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  selectedTimeSlot: string | null;

  @Column({ type: 'int' })
  persons: number;

  @Column({ type: 'json', nullable: true })
  addOns: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: false })
  acceptedTerms: boolean;

  @Column({
    type: 'enum',
    enum: EventRequestStatus,
    default: EventRequestStatus.DRAFT,
  })
  status: EventRequestStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  quotedPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  hallRentalPrice: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  addOnsSubtotal: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalAmount: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  paymentOption: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  depositAmount: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amountPaid: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  remainingAmount: number | null;

  @Column({
    type: 'enum',
    enum: [
      'credit_card',
      'debit_card',
      'mada',
      'wallet',
      'bank_transfer',
      'cash',
    ],
    nullable: true,
  })
  paymentMethod?: PaymentMethod;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'requesterId' })
  requester: User;
}
