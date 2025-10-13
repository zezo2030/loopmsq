import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { Payment, PaymentStatus, PaymentMethod } from '../../database/entities/payment.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
  ) {}

  async overview(input: { from?: string; to?: string; branchId?: string }) {
    const whereBooking: any = {};
    const whereTicket: any = {};
    const wherePayment: any = {};
    if (input.branchId) whereBooking.branchId = input.branchId;
    if (input.from && input.to) {
      whereBooking.createdAt = Between(new Date(input.from), new Date(input.to));
      whereTicket.createdAt = Between(new Date(input.from), new Date(input.to));
      wherePayment.createdAt = Between(new Date(input.from), new Date(input.to));
    }

    const [bookingsTotal, bookingsConfirmed, bookingsCancelled] = await Promise.all([
      this.bookingRepo.count({ where: whereBooking }),
      this.bookingRepo.count({ where: { ...whereBooking, status: BookingStatus.CONFIRMED } }),
      this.bookingRepo.count({ where: { ...whereBooking, status: BookingStatus.CANCELLED } }),
    ]);

    const scans = await this.ticketRepo.count({ where: whereTicket });

    const payments = await this.paymentRepo.find({ where: wherePayment });
    const revenueByMethod = payments.reduce((acc, p) => {
      if (p.status === PaymentStatus.COMPLETED) {
        const key = p.method || 'unknown';
        acc[key] = (acc[key] || 0) + Number(p.amount);
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      bookings: { total: bookingsTotal, confirmed: bookingsConfirmed, cancelled: bookingsCancelled },
      scans,
      revenueByMethod,
    };
  }
}


