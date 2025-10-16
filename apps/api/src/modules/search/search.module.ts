import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Payment } from '../../database/entities/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Booking, Payment])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}


