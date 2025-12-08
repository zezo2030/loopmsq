import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../../database/entities/favorite.entity';
import { ContentService } from '../content/content.service';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly favRepo: Repository<Favorite>,
    private readonly content: ContentService,
  ) {}

  async add(userId: string, entityType: 'branch' | 'hall', entityId: string) {
    await this.ensureExists(entityType, entityId);
    const exists = await this.favRepo.findOne({ where: { userId, entityType, entityId } });
    if (exists) return exists;
    const fav = this.favRepo.create({ userId, entityType, entityId });
    return this.favRepo.save(fav);
  }

  async remove(userId: string, entityType: 'branch' | 'hall', entityId: string) {
    await this.favRepo.delete({ userId, entityType, entityId });
    return { success: true };
  }

  async list(userId: string) {
    return this.favRepo.find({ where: { userId }, order: { createdAt: 'DESC' } as any });
  }

  private async ensureExists(entityType: 'branch' | 'hall', entityId: string) {
    if (entityType === 'branch') {
      const branch = await this.content.findBranchById(entityId);
      if (!branch) throw new BadRequestException('Branch not found');
    } else {
      // Hall type is no longer supported, treat as branch
      const branch = await this.content.findBranchById(entityId);
      if (!branch) throw new BadRequestException('Branch not found');
    }
  }
}


