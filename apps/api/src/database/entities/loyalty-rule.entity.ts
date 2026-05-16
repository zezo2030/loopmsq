import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('loyalty_rules')
export class LoyaltyRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // points per 1 currency unit (e.g., 1 point per 1 SAR)
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 1 })
  earnRate: number;

  // number of points required to redeem one free ticket
  @Column({ type: 'int', default: 500 })
  pointsPerTicket: number;

  // loyalty points granted to the referrer when a new user uses their code
  @Column({ type: 'int', default: 100 })
  referralRewardPoints: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
