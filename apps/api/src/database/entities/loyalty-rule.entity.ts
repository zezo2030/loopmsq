import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('loyalty_rules')
export class LoyaltyRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // points per 1 currency unit (e.g., 1 point per 1 SAR)
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 1 })
  earnRate: number;

  // currency per 1 point when redeeming (e.g., 0.05 SAR per 1 point)
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0.05 })
  redeemRate: number;

  @Column({ type: 'int', default: 0 })
  minRedeemPoints: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


