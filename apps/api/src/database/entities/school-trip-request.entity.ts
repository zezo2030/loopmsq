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
import { PaymentMethod } from './payment.entity';

export enum TripRequestStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  INVOICED = 'invoiced',
  PAID = 'paid',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('school_trip_requests')
@Index(['requesterId'])
@Index(['status'])
export class SchoolTripRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  requesterId: string;

  @Column({ type: 'uuid', nullable: true })
  branchId: string;

  @Column({ type: 'varchar', length: 200 })
  schoolName: string;

  @Column({ type: 'int' })
  studentsCount: number;

  @Column({ type: 'int', nullable: true })
  accompanyingAdults: number;

  @Column({ type: 'date' })
  preferredDate: Date;

  @Column({ type: 'time', nullable: true })
  preferredTime: string;

  @Column({ type: 'int', default: 2 })
  durationHours: number;

  @Column({
    type: 'enum',
    enum: TripRequestStatus,
    default: TripRequestStatus.PENDING,
  })
  status: TripRequestStatus;

  @Column({ type: 'varchar', length: 100 })
  contactPersonName: string;

  @Column({ type: 'varchar', length: 20 })
  contactPhone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail: string;

  @Column({ type: 'text', nullable: true })
  specialRequirements: string;

  @Column({ type: 'json', nullable: true })
  studentsList: {
    name: string;
    age: number;
    guardianName: string;
    guardianPhone: string;
  }[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  excelFilePath: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  quotedPrice: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  invoiceId: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'text', nullable: true })
  adminNotes: string;

  @Column({ type: 'json', nullable: true })
  addOns: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod?: PaymentMethod;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.schoolTripRequests)
  @JoinColumn({ name: 'requesterId' })
  requester: User;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approvedBy' })
  approver: User;
}
