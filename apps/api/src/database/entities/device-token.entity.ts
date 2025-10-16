import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('device_tokens')
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  user?: User | null;

  @Index({ unique: true })
  @Column({ type: 'text' })
  token: string;

  @Column({ type: 'varchar', length: 20, default: 'fcm' })
  provider: 'fcm' | 'apns';

  @Column({ type: 'varchar', length: 20, default: 'android' })
  platform: 'android' | 'ios';

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


