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
  PAID = 'paid',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

@Entity('event_requests')
@Index(['requesterId'])
@Index(['status'])
export class EventRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  requesterId: string;

  @Column({ type: 'varchar', length: 50 })
  type: string; // birthday, graduation, family, ...

  @Column({ type: 'boolean', default: false })
  decorated: boolean;

  @Column({ type: 'uuid', nullable: true })
  hallId: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'int', default: 2 })
  durationHours: number;

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

  @Column({ type: 'enum', enum: EventRequestStatus, default: EventRequestStatus.DRAFT })
  status: EventRequestStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  quotedPrice: number;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod?: PaymentMethod;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'requesterId' })
  requester: User;
}


