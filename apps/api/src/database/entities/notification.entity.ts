import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ type: 'uuid', nullable: true })
    userId?: string | null;

    @ManyToOne(() => User, (user) => user.notifications, {
        onDelete: 'CASCADE',
        nullable: true,
    })
    user?: User | null;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text' })
    body: string;

    @Column({ type: 'varchar', length: 50 })
    type: string;

    @Column({ type: 'boolean', default: false })
    isRead: boolean;

    @Column({ type: 'jsonb', nullable: true })
    data?: Record<string, unknown> | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
