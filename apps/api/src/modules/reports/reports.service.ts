import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Brackets, Repository } from 'typeorm';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import {
  Payment,
  PaymentStatus,
} from '../../database/entities/payment.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async overview(input: { from?: string; to?: string; branchId?: string }) {
    const fromDate =
      input.from && input.to ? new Date(input.from) : undefined;
    const toDate = input.from && input.to ? new Date(input.to) : undefined;

    const whereBooking: any = {};
    if (input.branchId) whereBooking.branchId = input.branchId;
    if (fromDate && toDate) {
      whereBooking.createdAt = Between(fromDate, toDate);
    }

    const [bookingsTotal, bookingsConfirmed, bookingsCancelled] =
      await Promise.all([
        this.bookingRepo.count({ where: whereBooking }),
        this.bookingRepo.count({
          where: { ...whereBooking, status: BookingStatus.CONFIRMED },
        }),
        this.bookingRepo.count({
          where: { ...whereBooking, status: BookingStatus.CANCELLED },
        }),
      ]);

    const scansQuery = this.ticketRepo.createQueryBuilder('ticket');
    if (input.branchId) {
      scansQuery
        .innerJoin('ticket.booking', 'booking')
        .andWhere('booking.branchId = :branchId', { branchId: input.branchId });
    }
    if (fromDate && toDate) {
      scansQuery.andWhere('ticket.createdAt BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate,
      });
    }
    const scans = await scansQuery.getCount();

    const paymentsQuery = this.paymentRepo.createQueryBuilder('payment');
    if (input.branchId) {
      paymentsQuery
        .leftJoin('payment.booking', 'booking')
        .leftJoin('payment.offerBooking', 'offerBooking')
        .leftJoin('payment.subscriptionPurchase', 'subscriptionPurchase')
        .leftJoin('payment.giftOrder', 'giftOrder')
        .leftJoin('payment.tripRequest', 'tripRequest')
        .leftJoin('payment.eventRequest', 'eventRequest')
        .andWhere(
          new Brackets((qb) => {
            qb.where('booking.branchId = :branchId', {
              branchId: input.branchId,
            })
              .orWhere('offerBooking.branchId = :branchId', {
                branchId: input.branchId,
              })
              .orWhere('subscriptionPurchase.branchId = :branchId', {
                branchId: input.branchId,
              })
              .orWhere('giftOrder.branchId = :branchId', {
                branchId: input.branchId,
              })
              .orWhere('tripRequest.branchId = :branchId', {
                branchId: input.branchId,
              })
              .orWhere('eventRequest.branchId = :branchId', {
                branchId: input.branchId,
              });
          }),
        );
    }
    if (fromDate && toDate) {
      paymentsQuery.andWhere('payment.createdAt BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate,
      });
    }
    const payments = await paymentsQuery.getMany();
    const revenueByMethod = payments.reduce(
      (acc, p) => {
        if (p.status === PaymentStatus.COMPLETED) {
          const key = p.method || 'unknown';
          acc[key] = (acc[key] || 0) + Number(p.amount);
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      bookings: {
        total: bookingsTotal,
        confirmed: bookingsConfirmed,
        cancelled: bookingsCancelled,
      },
      scans,
      revenueByMethod,
    };
  }
}
