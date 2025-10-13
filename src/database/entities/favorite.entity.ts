import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('favorites')
@Unique('uniq_user_entity', ['userId', 'entityType', 'entityId'])
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  entityType: 'branch' | 'hall';

  @Column({ type: 'uuid' })
  entityId: string;

  @CreateDateColumn()
  createdAt: Date;
}


