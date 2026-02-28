import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserRole } from '../../common/decorators/roles.decorator';
import { Booking } from './booking.entity';
import { Wallet } from './wallet.entity';
import { Branch } from './branch.entity';
import { SupportTicket } from './support-ticket.entity';
import { SchoolTripRequest } from './school-trip-request.entity';
import { DeviceToken } from './device-token.entity';
import { Notification } from './notification.entity';

@Entity('users')
@Index(['email'], { unique: true, where: 'email IS NOT NULL' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    array: true,
    default: [UserRole.USER],
  })
  roles: UserRole[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string;

  @Column({ type: 'varchar', length: 10, default: 'ar' })
  language: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Booking, (booking) => booking.user)
  bookings: Booking[];

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @OneToMany(() => SupportTicket, (ticket) => ticket.user)
  supportTickets: SupportTicket[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @OneToMany(() => SchoolTripRequest, (request) => request.requester)
  schoolTripRequests: SchoolTripRequest[];

  @ManyToOne(() => Branch, (branch) => branch.bookings, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  @Column({ type: 'uuid', nullable: true })
  branchId?: string;
}
