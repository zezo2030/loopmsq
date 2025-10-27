import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { Branch } from '../../database/entities/branch.entity';
import { Hall } from '../../database/entities/hall.entity';
import { RedisService } from '../../utils/redis.service';
import { SampleDataSeeder } from '../../database/seeders/sample-data.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, Hall])],
  controllers: [ContentController],
  providers: [
    ContentService,
    RedisService,
    SampleDataSeeder,
  ],
  exports: [ContentService],
})
export class ContentModule {}
