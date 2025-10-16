import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { Branch } from '../../database/entities/branch.entity';
import { Hall } from '../../database/entities/hall.entity';
import { RedisService } from '../../utils/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, Hall])],
  controllers: [ContentController],
  providers: [
    ContentService,
    RedisService,
  ],
  exports: [ContentService],
})
export class ContentModule {}
