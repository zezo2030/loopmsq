import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from './user.entity';

@Entity('referral_attributions')
@Unique('uniq_referee', ['refereeId'])
@Index(['referrerId'])
export class ReferralAttribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  refereeId: string; // invited user

  @Column({ type: 'uuid' })
  referrerId: string; // inviter

  @Column({ type: 'varchar', length: 32 })
  code: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'refereeId' })
  referee: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrerId' })
  referrer: User;
}


