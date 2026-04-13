import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { Branch } from '../../database/entities/branch.entity';
import { Addon } from '../../database/entities/addon.entity';
import { Offer } from '../../database/entities/offer.entity';
import { Booking } from '../../database/entities/booking.entity';
import { EventRequest } from '../../database/entities/event-request.entity';
import { RedisService } from '../../utils/redis.service';
import { RealtimeModule } from '../../realtime/realtime.module';
import { SampleDataSeeder } from '../../database/seeders/sample-data.seeder';
import { CloudinaryModule } from '../../utils/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Branch, Addon, Offer, Booking, EventRequest]),
    RealtimeModule,
    CloudinaryModule,
  ],
  controllers: [ContentController],
  providers: [ContentService, RedisService, SampleDataSeeder],
  exports: [ContentService],
})
export class ContentModule {}
