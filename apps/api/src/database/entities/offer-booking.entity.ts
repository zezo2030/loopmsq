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
} from 'typeorm';
import { User } from './user.entity';
import { Branch } from './branch.entity';
import { OfferProduct } from './offer-product.entity';
import { OfferTicket } from './offer-ticket.entity';
import { Payment } from './payment.entity';

export enum OfferBookingPaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum OfferBookingStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('offer_bookings')
@Index(['userId', 'createdAt'])
@Index(['branchId', 'createdAt'])
export class OfferBooking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'uuid' })
  offerProductId: string;

  @Column({ type: 'jsonb' })
  offerSnapshot: any;

  @Column({ type: 'jsonb', nullable: true })
  selectedAddOns: any;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  addonsTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({
    type: 'enum',
    enum: OfferBookingPaymentStatus,
    default: OfferBookingPaymentStatus.PENDING,
  })
  paymentStatus: OfferBookingPaymentStatus;

  @Column({
    type: 'enum',
    enum: OfferBookingStatus,
    default: OfferBookingStatus.ACTIVE,
  })
  status: OfferBookingStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  contactPhone: string;

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

  @ManyToOne(() => OfferProduct, { nullable: true })
  @JoinColumn({ name: 'offerProductId' })
  offerProduct: OfferProduct;

  @OneToMany(() => OfferTicket, (ticket) => ticket.offerBooking)
  tickets: OfferTicket[];

  @OneToMany(() => Payment, (payment) => payment.offerBooking)
  payments: Payment[];
}
