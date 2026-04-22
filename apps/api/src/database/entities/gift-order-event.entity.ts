import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { GiftOrder } from './gift-order.entity';

@Entity('gift_order_events')
@Index('idx_gift_events_order', ['giftOrderId'])
@Index('idx_gift_events_type', ['eventType'])
@Index('idx_gift_events_created', ['createdAt'])
export class GiftOrderEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  giftOrderId: string;

  @Column({ type: 'varchar', length: 50 })
  eventType: string;

  @Column({ type: 'varchar', length: 20 })
  actorType: string;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => GiftOrder, { nullable: true })
  @JoinColumn({ name: 'giftOrderId' })
  giftOrder: GiftOrder;
}
