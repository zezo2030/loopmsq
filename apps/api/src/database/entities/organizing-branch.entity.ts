import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('organizing_branches')
export class OrganizingBranch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  videoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  videoCoverUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

