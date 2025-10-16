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
import { Booking } from './booking.entity';
import { User } from './user.entity';

export enum TicketStatus {
  VALID = 'valid',
  USED = 'used',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('tickets')
@Index(['qrTokenHash'], { unique: true })
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  qrTokenHash: string;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.VALID })
  status: TicketStatus;

  @Column({ type: 'timestamp', nullable: true })
  scannedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  staffId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  holderName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  holderPhone: string;

  @Column({ type: 'int', default: 1 })
  personCount: number;

  @Column({ type: 'timestamp', nullable: true })
  validFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  validUntil: Date;

  @Column({ type: 'json', nullable: true })
  metadata: {
    seatNumber?: string;
    specialAccess?: string[];
    notes?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Booking, (booking) => booking.tickets)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'staffId' })
  staff: User;
}
