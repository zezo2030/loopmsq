import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventRequest, EventRequestStatus } from '../../database/entities/event-request.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { CreateEventRequestDto } from './dto/create-event-request.dto';
import { QuoteEventRequestDto } from './dto/quote-event-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ContentService } from '../content/content.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(EventRequest)
    private readonly eventRepo: Repository<EventRequest>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly contentService: ContentService,
  ) { }

  async createRequest(userId: string, dto: CreateEventRequestDto) {
    const req = this.eventRepo.create({
      requesterId: userId,
      type: dto.type,
      decorated: dto.decorated || false,
      branchId: dto.branchId,
      startTime: new Date(dto.startTime),
      durationHours: dto.durationHours,
      persons: dto.persons,
      addOns: dto.addOns,
      notes: dto.notes,
      status: EventRequestStatus.SUBMITTED,
    });
    const saved = await this.eventRepo.save(req);
    // status submitted
    await this.notifications.enqueue({
      type: 'EVENT_STATUS',
      to: { userId },
      data: { status: 'SUBMITTED' },
      channels: ['sms', 'push'],
    });
    return { id: saved.id };
  }

  async getRequest(user: any, id: string) {
    const req = await this.eventRepo.findOne({
      where: { id },
      relations: ['requester'],
    });
    if (!req) throw new NotFoundException('Request not found');
    const isOwner = req.requesterId === user.id;
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isOwner && !isStaff) throw new ForbiddenException('Not allowed');

    // Load branch data
    if (req.branchId) {
      try {
        const branch = await this.contentService.findBranchById(req.branchId);
        (req as any).branch = branch;
      } catch (error) {
        this.logger.error(`Failed to load branch ${req.branchId} for event request ${req.id}`, error);
      }
    }

    return req;
  }

  async findUserRequests(
    userId: string,
    page: number = 1,
    limit: number = 10,
    filters?: { status?: string; type?: string },
  ): Promise<{
    requests: EventRequest[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: any = { requesterId: userId };
    if (filters?.status) where.status = filters.status as any;
    if (filters?.type) where.type = filters.type;

    const [requests, total] = await this.eventRepo.findAndCount({
      where,
      relations: ['requester'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Load branch data for each request
    for (const request of requests) {
      if (request.branchId) {
        try {
          const branch = await this.contentService.findBranchById(request.branchId);
          (request as any).branch = branch;
        } catch (error) {
          this.logger.error(`Failed to load branch ${request.branchId} for event request ${request.id}`, error);
        }
      }
    }

    return {
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async quote(id: string, dto: QuoteEventRequestDto) {
    const req = await this.eventRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== EventRequestStatus.SUBMITTED && req.status !== EventRequestStatus.UNDER_REVIEW) {
      throw new BadRequestException('Only submitted/under_review can be quoted');
    }
    const base = dto.basePrice ?? 0;
    const addOnsTotal = (req.addOns || []).reduce((s, a) => s + a.price * a.quantity, 0);
    req.quotedPrice = base + addOnsTotal;
    req.status = EventRequestStatus.QUOTED;
    await this.eventRepo.save(req);
    await this.notifications.enqueue({
      type: 'EVENT_STATUS',
      to: { userId: req.requesterId },
      data: { status: 'QUOTED' },
      channels: ['sms', 'push'],
    });
    return { quotedPrice: req.quotedPrice };
  }

  async confirm(id: string) {
    const req = await this.eventRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== EventRequestStatus.PAID && req.status !== EventRequestStatus.QUOTED) {
      throw new BadRequestException('Only paid/quoted can be confirmed');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      req.status = EventRequestStatus.CONFIRMED;
      await queryRunner.manager.save(req);

      // Create Booking to represent the confirmed event (for ticket generation)
      // Note: Booking entity doesn't explicitly link to eventRequest, but we mirror the details
      const booking = queryRunner.manager.create(Booking, {
        userId: req.requesterId,
        branchId: req.branchId,
        startTime: req.startTime,
        durationHours: req.durationHours,
        persons: req.persons,
        totalPrice: req.quotedPrice || 0,
        status: BookingStatus.CONFIRMED,
        addOns: req.addOns,
        specialRequests: req.notes,
        // We could store the eventRequestId in specialRequests or metadata if needed, 
        // but for now just creating the booking ensures tickets can be linked.
      } as Partial<Booking>);

      const savedBooking = await queryRunner.manager.save(booking);

      // Generate tickets
      const tickets: Ticket[] = [];
      for (let i = 0; i < req.persons; i++) {
        const t = queryRunner.manager.create(Ticket, {
          bookingId: savedBooking.id,
          qrTokenHash: '', // Placeholder, should be generated if using QR service logic
          status: TicketStatus.VALID,
          personCount: 1,
          validFrom: savedBooking.startTime,
          validUntil: new Date(savedBooking.startTime.getTime() + savedBooking.durationHours * 3600 * 1000),
        } as Partial<Ticket>);
        tickets.push(t);
      }
      await queryRunner.manager.save(tickets);

      await queryRunner.commitTransaction();

      await this.notifications.enqueue({
        type: 'EVENT_STATUS',
        to: { userId: req.requesterId },
        data: { status: 'CONFIRMED' },
        channels: ['sms', 'push'],
      });

      // Also notify tickets issued
      await this.notifications.enqueue({
        type: 'TICKETS_ISSUED',
        to: { userId: req.requesterId },
        data: { bookingId: savedBooking.id },
        channels: ['sms', 'push'],
      });

      return { success: true };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to confirm event ${id}`, e);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllRequests(
    page: number = 1,
    limit: number = 10,
    filters?: { status?: string; type?: string; branchId?: string; from?: string; to?: string },
  ): Promise<{
    requests: EventRequest[];
    total: number;
    page: number;
    totalPages: number;
    stats: {
      total: number;
      pending: number; // submitted or under_review
      quoted: number;
      confirmed: number;
      totalRevenue: number;
    };
  }> {
    const where: any = {};
    if (filters?.status) where.status = filters.status as any;
    if (filters?.type) where.type = filters.type;
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.from && filters?.to) {
      where.startTime = ({} as any);
      (where.startTime as any).$gte = new Date(filters.from) as any;
      (where.startTime as any).$lte = new Date(filters.to) as any;
    }

    const [requests, total] = await this.eventRepo.findAndCount({
      where,
      relations: ['requester'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    } as any);

    // Load branch data for each request
    for (const request of requests) {
      if (request.branchId) {
        try {
          const branch = await this.contentService.findBranchById(request.branchId);
          (request as any).branch = branch;
        } catch (error) {
          this.logger.error(`Failed to load branch ${request.branchId} for event request ${request.id}`, error);
        }
      }
    }

    const pending = await this.eventRepo.count({ where: [{ ...where, status: 'submitted' as any }, { ...where, status: 'under_review' as any }] as any });
    const quoted = await this.eventRepo.count({ where: { ...where, status: 'quoted' as any } });
    const confirmed = await this.eventRepo.count({ where: { ...where, status: 'confirmed' as any } });
    const paidList = await this.eventRepo.find({ where: { ...where, status: 'paid' as any } });
    const confirmedList = await this.eventRepo.find({ where: { ...where, status: 'confirmed' as any } });
    const totalRevenue = [...paidList, ...confirmedList]
      .map((r) => Number(r.quotedPrice || 0))
      .reduce((a, b) => a + b, 0);

    return {
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total,
        pending,
        quoted,
        confirmed,
        totalRevenue,
      },
    };
  }

  async getEventTickets(eventRequestId: string, user: any): Promise<Ticket[]> {
    // Verify access
    const eventRequest = await this.eventRepo.findOne({
      where: { id: eventRequestId },
    });
    if (!eventRequest) throw new NotFoundException('Event request not found');
    
    const isOwner = eventRequest.requesterId === user.id;
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isOwner && !isStaff) throw new ForbiddenException('Not allowed');

    // Find payment linked to this event request
    const payment = await this.paymentRepo.findOne({
      where: {
        eventRequestId: eventRequestId,
        status: PaymentStatus.COMPLETED,
      },
    });

    if (!payment || !payment.bookingId) {
      // If no payment found, try to find booking by matching event request details
      // This handles cases where booking was created during payment confirmation
      const booking = await this.bookingRepo.findOne({
        where: {
          userId: eventRequest.requesterId,
          branchId: eventRequest.branchId,
          startTime: eventRequest.startTime,
          persons: eventRequest.persons,
          status: BookingStatus.CONFIRMED,
        },
        order: { createdAt: 'DESC' },
      });

      if (booking) {
        const tickets = await this.ticketRepo.find({
          where: { bookingId: booking.id },
        });
        return tickets;
      }
      return [];
    }

    // Get tickets from the booking linked to the payment
    const tickets = await this.ticketRepo.find({
      where: { bookingId: payment.bookingId },
    });

    return tickets;
  }
}
