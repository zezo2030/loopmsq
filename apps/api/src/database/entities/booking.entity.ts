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
import { User } from './user.entity';
import { Branch } from './branch.entity';
import { Hall } from './hall.entity';
import { Ticket } from './ticket.entity';
import { Payment } from './payment.entity';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity('bookings')
@Index(['startTime'])
@Index(['userId'])
@Index(['branchId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'uuid', nullable: true })
  hallId: string;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'int' })
  durationHours: number;

  @Column({ type: 'int' })
  persons: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'json', nullable: true })
  addOns: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  couponCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountAmount: number;

  @Column({ type: 'text', nullable: true })
  specialRequests: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  contactPhone: string;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.bookings)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Branch, (branch) => branch.bookings)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => Hall, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hallId' })
  hall: Hall;

  @OneToMany(() => Ticket, (ticket) => ticket.booking)
  tickets: Ticket[];

  @OneToMany(() => Payment, (payment) => payment.booking)
  payments: Payment[];
}
