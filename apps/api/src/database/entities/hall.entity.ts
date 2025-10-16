import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';

@Entity('halls')
export class Hall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'varchar', length: 100 })
  name_ar: string;

  @Column({ type: 'varchar', length: 100 })
  name_en: string;

  @Column({ type: 'json' })
  priceConfig: {
    basePrice: number;
    hourlyRate: number;
    weekendMultiplier: number;
    holidayMultiplier: number;
    decorationPrice?: number;
  };

  @Column({ type: 'boolean', default: false })
  isDecorated: boolean;

  @Column({ type: 'int' })
  capacity: number;

  @Column({
    type: 'enum',
    enum: ['available', 'maintenance', 'reserved'],
    default: 'available',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  description_ar: string;

  @Column({ type: 'text', nullable: true })
  description_en: string;

  @Column({ type: 'json', nullable: true })
  features: string[];

  @Column({ type: 'json', nullable: true })
  images: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Branch, (branch) => branch.halls)
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
