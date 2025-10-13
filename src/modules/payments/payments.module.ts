import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from '../../database/entities/payment.entity';
import { Booking } from '../../database/entities/booking.entity';
import { UsersModule } from '../users/users.module';
import { RedisService } from '../../utils/redis.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Booking]),
    UsersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, RedisService],
  exports: [PaymentsService],
})
export class PaymentsModule {}


