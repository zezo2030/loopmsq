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
import { Branch } from './branch.entity';

export enum OfferCategory {
  TICKET_BASED = 'ticket_based',
  HOUR_BASED = 'hour_based',
}

@Entity('offer_products')
@Index(['branchId', 'isActive', 'createdAt'])
export class OfferProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  imageUrl: string;

  @Column({ type: 'text', nullable: true })
  termsAndConditions: string | null;

  @Column({ type: 'enum', enum: OfferCategory })
  offerCategory: OfferCategory;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 3, default: 'SAR' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date;

  @Column({ type: 'boolean', default: false })
  isGiftable: boolean;

  @Column({ type: 'boolean', default: true })
  canRepeatInSameOrder: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  includedAddOns: {
    addonId?: string;
    name?: string;
    price?: number;
    quantity: number;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  ticketConfig: {
    paidTicketCount: number;
    freeTicketCount: number;
    totalGeneratedCount: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  hoursConfig: {
    durationHours: number;
    bonusHours?: number;
    isOpenTime?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
