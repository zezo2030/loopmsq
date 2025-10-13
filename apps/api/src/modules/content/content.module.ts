import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { Branch } from '../../database/entities/branch.entity';
import { Hall } from '../../database/entities/hall.entity';
import { RedisService } from '../../utils/redis.service';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, Hall])],
  controllers: [ContentController],
  providers: [
    ContentService,
    RedisService,
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
  exports: [ContentService],
})
export class ContentModule {}
