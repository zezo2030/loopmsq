import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

export enum ReferralEarningStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('referral_earnings')
@Index(['referrerId'])
@Index(['refereeId'])
@Index(['status'])
export class ReferralEarning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  referrerId: string;

  @Column({ type: 'uuid' })
  refereeId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'uuid', nullable: true })
  sourcePaymentId?: string;

  @Column({ type: 'enum', enum: ReferralEarningStatus, default: ReferralEarningStatus.PENDING })
  status: ReferralEarningStatus;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrerId' })
  referrer: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'refereeId' })
  referee: User;
}


