import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('addons')
export class Addon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  branchId: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  hallId: string | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int', default: 1 })
  defaultQuantity: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}




