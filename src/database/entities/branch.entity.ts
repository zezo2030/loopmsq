import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Hall } from './hall.entity';
import { Booking } from './booking.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name_ar: string;

  @Column({ type: 'varchar', length: 100 })
  name_en: string;

  @Column({ type: 'text' })
  location: string;

  @Column({ type: 'int' })
  capacity: number;

  @Column({ type: 'enum', enum: ['active', 'inactive', 'maintenance'], default: 'active' })
  status: string;

  @Column({ type: 'text', nullable: true })
  description_ar: string;

  @Column({ type: 'text', nullable: true })
  description_en: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  contactPhone: string;

  @Column({ type: 'json', nullable: true })
  workingHours: {
    [key: string]: { open: string; close: string; closed?: boolean };
  };

  @Column({ type: 'json', nullable: true })
  amenities: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Hall, (hall) => hall.branch)
  halls: Hall[];

  @OneToMany(() => Booking, (booking) => booking.branch)
  bookings: Booking[];
}
