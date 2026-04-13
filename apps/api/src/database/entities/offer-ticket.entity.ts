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
import { Branch } from './branch.entity';
import { OfferProduct } from './offer-product.entity';
import { OfferBooking } from './offer-booking.entity';

export enum OfferTicketKind {
  STANDARD = 'standard',
  TIMED = 'timed',
}

export enum OfferTicketStatus {
  VALID = 'valid',
  IN_USE = 'in_use',
  USED = 'used',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('offer_tickets')
@Index(['qrTokenHash'], { unique: true })
@Index(['offerBookingId'])
@Index(['branchId', 'status'])
export class OfferTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  offerBookingId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'uuid' })
  offerProductId: string;

  @Column({ type: 'enum', enum: OfferTicketKind })
  ticketKind: OfferTicketKind;

  @Column({ type: 'varchar', length: 255, unique: true })
  qrTokenHash: string;

  @Column({
    type: 'enum',
    enum: OfferTicketStatus,
    default: OfferTicketStatus.VALID,
  })
  status: OfferTicketStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  scannedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  staffId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => OfferBooking, (booking) => booking.tickets)
  @JoinColumn({ name: 'offerBookingId' })
  offerBooking: OfferBooking;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => OfferProduct, { nullable: true })
  @JoinColumn({ name: 'offerProductId' })
  offerProduct: OfferProduct;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'staffId' })
  staff: User;
}
