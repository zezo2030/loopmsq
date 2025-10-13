import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Booking } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Branch } from '../../database/entities/branch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Ticket, Payment, Branch])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}


