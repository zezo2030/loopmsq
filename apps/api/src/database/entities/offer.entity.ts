import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';

@Entity('offers')
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Temporarily nullable to allow migration - will be enforced via validation
  @Column({ type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ['percentage', 'fixed', 'bogo'],
    default: 'percentage',
  })
  discountType: 'percentage' | 'fixed' | 'bogo';

  /** For percentage/fixed only. Ignored for BOGO (BOGO does not reduce price). */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValue: number;

  /** BOGO: paid tickets per group (default 1). */
  @Column({ type: 'int', nullable: true, default: 1 })
  buyCount: number | null;

  /** BOGO: free tickets per completed buy group (default 1). */
  @Column({ type: 'int', nullable: true, default: 1 })
  freeCount: number | null;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Branch, (branch) => branch.bookings)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
