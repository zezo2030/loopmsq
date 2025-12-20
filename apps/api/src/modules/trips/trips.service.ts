import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SchoolTripRequest, TripRequestStatus } from '../../database/entities/school-trip-request.entity';
import * as XLSX from 'xlsx';
import { InvoiceTripRequestDto } from './dto/invoice-trip-request.dto';
import { IssueTicketsDto } from './dto/issue-tickets.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { User } from '../../database/entities/user.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { CreateTripRequestDto } from './dto/create-trip-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitTripRequestDto } from './dto/submit-trip-request.dto';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(SchoolTripRequest)
    private readonly tripRepo: Repository<SchoolTripRequest>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly notifications: NotificationsService,
  ) { }

  async createRequest(userId: string, dto: CreateTripRequestDto) {
    const req = this.tripRepo.create({
      requesterId: userId,
      branchId: dto.branchId,
      schoolName: dto.schoolName,
      studentsCount: dto.studentsCount || 0, // Will be updated from Excel file
      accompanyingAdults: dto.accompanyingAdults,
      preferredDate: new Date(dto.preferredDate as any),
      preferredTime: dto.preferredTime,
      durationHours: dto.durationHours ?? 2,
      contactPersonName: dto.contactPersonName,
      contactPhone: dto.contactPhone,
      contactEmail: dto.contactEmail,
      specialRequirements: dto.specialRequirements,
      addOns: dto.addOns,
      paymentMethod: dto.paymentMethod,
      status: TripRequestStatus.PENDING,
    });
    const saved = await this.tripRepo.save(req);
    return { id: saved.id };
  }

  async getRequest(user: any, id: string) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    const isOwner = req.requesterId === user.id;
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isOwner && !isStaff) throw new ForbiddenException('Not allowed');
    return req;
  }

  async submitRequest(userId: string, id: string, dto: SubmitTripRequestDto) {
    const req = await this.tripRepo.findOne({ where: { id, requesterId: userId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== TripRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be submitted');
    }
    req.status = TripRequestStatus.UNDER_REVIEW;
    await this.tripRepo.save(req);
    // notify status
    await this.notifications.enqueue({
      type: 'TRIP_STATUS',
      to: { userId },
      data: { status: 'UNDER_REVIEW' },
      channels: ['sms'],
    });
    return { success: true };
  }

  async approveRequest(approverId: string, id: string, quotedPrice?: number, adminNotes?: string) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== TripRequestStatus.UNDER_REVIEW) {
      throw new BadRequestException('Only under_review requests can be approved');
    }

    // Calculate price if not provided
    if (quotedPrice) {
      req.quotedPrice = quotedPrice;
    } else {
      const baseCount = (req.studentsList?.length || req.studentsCount) + (req.accompanyingAdults || 0);
      const pricePerPerson = 50; // SAR default pricing
      const addOnsTotal = (req.addOns || []).reduce((sum, a) => sum + (a.price * a.quantity), 0);
      req.quotedPrice = baseCount * pricePerPerson + addOnsTotal;
    }

    req.status = TripRequestStatus.APPROVED;
    req.approvedAt = new Date();
    req.approvedBy = approverId;
    if (adminNotes) req.adminNotes = adminNotes;

    await this.tripRepo.save(req);

    await this.notifications.enqueue({
      type: 'TRIP_STATUS',
      to: { userId: req.requesterId },
      data: {
        status: 'APPROVED',
        quotedPrice: req.quotedPrice,
      },
      channels: ['sms', 'push'],
    });

    return { success: true, quotedPrice: req.quotedPrice };
  }

  async uploadParticipants(userId: string, id: string, file: Express.Multer.File) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.requesterId !== userId && req.status !== TripRequestStatus.UNDER_REVIEW) {
      throw new ForbiddenException('Not allowed');
    }
    if (!file) throw new BadRequestException('File is required');
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: '',
      raw: false,
      blankrows: false,
    });
    const participants = rows.map((r, idx) => {
      if (!r.name || !r.guardianPhone) {
        throw new BadRequestException(`Invalid row ${idx + 2}: name and guardianPhone are required`);
      }
      return {
        name: String(r.name).trim(),
        age: Number(r.age || 0),
        guardianName: String(r.guardianName || '').trim(),
        guardianPhone: String(r.guardianPhone).trim(),
      };
    });
    req.studentsList = participants;
    req.studentsCount = participants.length; // Update studentsCount from Excel file
    req.excelFilePath = file.path;
    await this.tripRepo.save(req);
    return { count: participants.length };
  }

  async createInvoice(approverId: string, id: string, dto: InvoiceTripRequestDto) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== TripRequestStatus.APPROVED) {
      throw new BadRequestException('Only approved requests can be invoiced');
    }
    const baseCount = (req.studentsList?.length || req.studentsCount) + (req.accompanyingAdults || 0);
    const pricePerPerson = 50; // SAR mock pricing
    const addOnsTotal = (req.addOns || []).reduce((sum, a) => sum + (a.price * a.quantity), 0);
    const total = dto.overrideAmount ?? baseCount * pricePerPerson + addOnsTotal;
    req.quotedPrice = total;
    req.status = TripRequestStatus.INVOICED;
    req.invoiceId = `inv_${req.id}`;
    await this.tripRepo.save(req);
    await this.notifications.enqueue({
      type: 'TRIP_STATUS',
      to: { userId: req.requesterId },
      data: { status: 'INVOICED' },
      channels: ['sms', 'push'],
    });
    return { invoiceId: req.invoiceId, amount: total, currency: dto.currency || 'SAR' };
  }

  async issueTickets(issuerId: string, id: string, dto: IssueTicketsDto) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');

    // Allow issuing tickets after payment (PAID) or directly after approval (APPROVED)
    if (req.status !== TripRequestStatus.PAID && req.status !== TripRequestStatus.APPROVED) {
      throw new BadRequestException('Tickets can be issued only after payment or approval');
    }

    // Create a booking representing the trip
    const studentsList = req.studentsList || [];
    const studentsCount = studentsList.length || req.studentsCount || 0;
    const adultsCount = req.accompanyingAdults || 0;
    const totalPersons = studentsCount + adultsCount;

    // derive branch from issuer if available
    const issuer = await this.userRepo.findOne({ where: { id: issuerId } });
    const bookingData: Partial<Booking> = {
      userId: req.requesterId,
      branchId: (req as any).branchId || issuer?.branchId,
      startTime: new Date(dto.startTime),
      durationHours: dto.durationHours as any,
      persons: totalPersons as any,
      totalPrice: Number(req.quotedPrice ?? totalPersons * 50) as any,
      status: BookingStatus.CONFIRMED,
    };
    const booking = this.bookingRepo.create(bookingData);
    const savedBooking = await this.bookingRepo.save(booking);

    // Generate tickets for each participant/person
    const tickets: Ticket[] = [];

    // Create tickets for students with their names
    for (let i = 0; i < studentsList.length; i++) {
      const student = studentsList[i];
      const t = this.ticketRepo.create({
        bookingId: savedBooking.id,
        qrTokenHash: `trip_${savedBooking.id}_${i}`, // Temporary hash, will be updated by QR flow
        status: TicketStatus.VALID,
        personCount: 1,
        holderName: student.name, // ✅ اسم الطالب
        holderPhone: student.guardianPhone,
        validFrom: savedBooking.startTime as any,
        validUntil: new Date(
          (savedBooking.startTime as any as Date).getTime() + (savedBooking.durationHours as any as number) * 3600 * 1000,
        ),
        metadata: {
          studentAge: student.age,
          guardianName: student.guardianName,
          tripType: 'school',
        },
      } as Partial<Ticket>);
      tickets.push(t);
    }

    // Create tickets for accompanying adults
    for (let i = 0; i < adultsCount; i++) {
      const t = this.ticketRepo.create({
        bookingId: savedBooking.id,
        qrTokenHash: `trip_${savedBooking.id}_adult_${i}`,
        status: TicketStatus.VALID,
        personCount: 1,
        holderName: `مرافق ${i + 1}`, // ✅ اسم عام للمرافقين
        validFrom: savedBooking.startTime as any,
        validUntil: new Date(
          (savedBooking.startTime as any as Date).getTime() + (savedBooking.durationHours as any as number) * 3600 * 1000,
        ),
        metadata: {
          tripType: 'school',
          role: 'adult',
        },
      } as Partial<Ticket>);
      tickets.push(t);
    }

    await this.ticketRepo.save(tickets);

    // Send notifications (welcome message / tickets issued)
    await this.notifications.enqueue({
      type: 'TICKETS_ISSUED',
      to: { userId: req.requesterId },
      data: { bookingId: savedBooking.id, welcomeMessage: dto.welcomeMessage },
      lang: 'ar',
      channels: ['sms', 'push'],
    });

    req.status = TripRequestStatus.COMPLETED;
    await this.tripRepo.save(req);

    return { bookingId: savedBooking.id, ticketsCount: tickets.length };
  }

  async markPaid(approverId: string, id: string, dto: any) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== TripRequestStatus.INVOICED) {
      throw new BadRequestException('Only invoiced requests can be marked paid');
    }
    req.status = TripRequestStatus.PAID;
    await this.tripRepo.save(req);
    await this.notifications.enqueue({
      type: 'TRIP_STATUS',
      to: { userId: req.requesterId },
      data: { status: 'PAID' },
      channels: ['sms', 'push'],
    });
    return { success: true };
  }

  async findUserRequests(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<{
    requests: SchoolTripRequest[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: any = { requesterId: userId };
    if (status) where.status = status as any;

    const [requests, total] = await this.tripRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    } as any);

    return {
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllRequests(
    page: number = 1,
    limit: number = 10,
    filters?: { status?: string; from?: string; to?: string },
  ): Promise<{
    requests: SchoolTripRequest[];
    total: number;
    page: number;
    totalPages: number;
    stats: {
      total: number;
      pending: number;
      approved: number;
      completed: number;
      totalRevenue: number;
    };
  }> {
    const where: any = {};
    if (filters?.status) where.status = filters.status as any;
    if (filters?.from && filters?.to) {
      where.preferredDate = ({} as any);
      (where.preferredDate as any).$gte = new Date(filters.from) as any;
      (where.preferredDate as any).$lte = new Date(filters.to) as any;
    }

    const [requests, total] = await this.tripRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    } as any);

    // Stats (respect filters)
    const pending = await this.tripRepo.count({ where: { ...where, status: 'pending' as any } });
    const approved = await this.tripRepo.count({ where: { ...where, status: 'approved' as any } });
    const completed = await this.tripRepo.count({ where: { ...where, status: 'completed' as any } });
    const paidList = await this.tripRepo.find({ where: { ...where, status: 'paid' as any } });
    const completedList = await this.tripRepo.find({ where: { ...where, status: 'completed' as any } });
    const totalRevenue = [...paidList, ...completedList]
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
        approved,
        completed,
        totalRevenue,
      },
    };
  }

  /**
   * User pays for an approved trip request
   * This will create a payment intent  and after successful payment,
   * automatically issue tickets and mark as completed
   */
  async payForTrip(userId: string, id: string, dto: { paymentMethod?: string }) {
    const req = await this.tripRepo.findOne({ where: { id, requesterId: userId } });
    if (!req) throw new NotFoundException('Request not found');

    if (req.status !== TripRequestStatus.APPROVED) {
      throw new BadRequestException('Only approved requests can be paid');
    }

    if (!req.quotedPrice || req.quotedPrice <= 0) {
      throw new BadRequestException('No quoted price available');
    }

    // For now, we'll simulate successful payment
    // In production, this should integrate with the PaymentsService
    // to create a payment intent and handle the actual payment flow

    // TODO: Integrate with PaymentsService.createIntent()
    // const paymentIntent = await this.paymentsService.createIntent(userId, {
    //   tripRequestId: id,
    //   method: dto.paymentMethod || PaymentMethod.CREDIT_CARD,
    // });

    // For now, mark as paid immediately (simulate successful payment)
    req.status = TripRequestStatus.PAID;
    req.paymentMethod = dto.paymentMethod as any;
    await this.tripRepo.save(req);

    // Send notification
    await this.notifications.enqueue({
      type: 'TRIP_STATUS',
      to: { userId: req.requesterId },
      data: {
        status: 'PAID',
        amount: req.quotedPrice,
      },
      channels: ['sms', 'push'],
    });

    // Automatically issue tickets after payment
    // Using the trip's preferred date and duration
    const issueDto: IssueTicketsDto = {
      startTime: req.preferredDate.toISOString(),
      durationHours: req.durationHours,
      welcomeMessage: `مرحباً بكم في رحلة ${req.schoolName}`,
    };

    const ticketsResult = await this.issueTickets(userId, id, issueDto);

    return {
      success: true,
      status: 'PAID_AND_COMPLETED',
      quotedPrice: req.quotedPrice,
      bookingId: ticketsResult.bookingId,
      ticketsCount: ticketsResult.ticketsCount,
    };
  }

  async getTripTickets(tripRequestId: string, user: any): Promise<Ticket[]> {
    // Verify access
    const tripRequest = await this.tripRepo.findOne({
      where: { id: tripRequestId },
    });
    if (!tripRequest) throw new NotFoundException('Trip request not found');
    
    const isOwner = tripRequest.requesterId === user.id;
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isOwner && !isStaff) throw new ForbiddenException('Not allowed');

    // First, try to find payment linked to this trip request
    const payment = await this.paymentRepo.findOne({
      where: {
        tripRequestId: tripRequestId,
        status: PaymentStatus.COMPLETED,
      },
    });

    if (payment && payment.bookingId) {
      // Get tickets from the booking linked to the payment
      const tickets = await this.ticketRepo.find({
        where: { bookingId: payment.bookingId },
        relations: ['staff'], // Load staff relation to get staff name
      });
      return tickets;
    }

    // If no payment found, try to find booking by matching trip request details
    // This handles cases where booking was created during payment confirmation
    const booking = await this.bookingRepo.findOne({
      where: {
        userId: tripRequest.requesterId,
        branchId: tripRequest.branchId,
        startTime: tripRequest.preferredDate,
        status: BookingStatus.CONFIRMED,
      },
      order: { createdAt: 'DESC' },
    });

    if (booking) {
      const tickets = await this.ticketRepo.find({
        where: { bookingId: booking.id },
        relations: ['staff'], // Load staff relation to get staff name
      });
      return tickets;
    }

    return [];
  }
}


