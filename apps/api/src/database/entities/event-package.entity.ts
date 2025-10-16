import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('event_packages')
export class EventPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  eventType: string; // birthday, graduation, etc

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pricePerPerson: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pricePerHour: number;

  @Column({ type: 'int', nullable: true })
  minPersons: number | null;

  @Column({ type: 'int', nullable: true })
  maxPersons: number | null;

  @Column({ type: 'int', nullable: true })
  minDuration: number | null;

  @Column({ type: 'int', nullable: true })
  maxDuration: number | null;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  items: { id?: string; name: string; price?: number; quantity?: number }[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


