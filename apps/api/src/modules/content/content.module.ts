import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { Branch } from '../../database/entities/branch.entity';
import { Addon } from '../../database/entities/addon.entity';
import { Booking } from '../../database/entities/booking.entity';
import { RedisService } from '../../utils/redis.service';
import { RealtimeModule } from '../../realtime/realtime.module';
import { SampleDataSeeder } from '../../database/seeders/sample-data.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, Addon, Booking]), RealtimeModule],
  controllers: [ContentController],
  providers: [
    ContentService,
    RedisService,
    SampleDataSeeder,
  ],
  exports: [ContentService],
})
export class ContentModule {}
