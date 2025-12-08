import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
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

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active',
  })
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

  @Column({ type: 'text', nullable: true })
  videoUrl: string;

  @Column({ type: 'text', nullable: true })
  coverImage: string | null;

  @Column({ type: 'json', nullable: true })
  images: string[];

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

  // Hall-related fields (merged from Hall entity)
  @Column({ type: 'json', nullable: true })
  priceConfig: {
    basePrice: number;
    hourlyRate: number;
    pricePerPerson: number;
    weekendMultiplier: number;
    holidayMultiplier: number;
    decorationPrice?: number;
  };

  @Column({ type: 'boolean', default: false })
  isDecorated: boolean;

  @Column({ type: 'json', nullable: true })
  hallFeatures: string[];

  @Column({ type: 'json', nullable: true })
  hallImages: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  hallVideoUrl: string;

  @Column({
    type: 'enum',
    enum: ['available', 'maintenance', 'reserved'],
    default: 'available',
  })
  hallStatus: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Booking, (booking) => booking.branch)
  bookings: Booking[];
}
