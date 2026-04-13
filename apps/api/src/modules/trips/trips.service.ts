import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import {
  SchoolTripRequest,
  TripRequestStatus,
} from '../../database/entities/school-trip-request.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Branch } from '../../database/entities/branch.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { User } from '../../database/entities/user.entity';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../database/entities/payment.entity';
import { InvoiceTripRequestDto } from './dto/invoice-trip-request.dto';
import { IssueTicketsDto } from './dto/issue-tickets.dto';
import { CreateTripRequestDto } from './dto/create-trip-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitTripRequestDto } from './dto/submit-trip-request.dto';
import { RejectTripRequestDto } from './dto/reject-trip-request.dto';
import { CancelTripRequestDto } from './dto/cancel-trip-request.dto';
import { UpdateTripRequestDto } from './dto/update-trip-request.dto';
import { ContentService } from '../content/content.service';
import { QRCodeService } from '../../utils/qr-code.service';

type ResolvedTripAddOn = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

@Injectable()
export class TripsService {
  private static readonly MINIMUM_STUDENTS = 35;
  private static readonly DEFAULT_TICKET_PRICE = 45;
  private static readonly DEPOSIT_PERCENTAGE = 20;
  private static readonly TIME_SLOTS = ['07:30-09:30', '10:00-12:00'];
  private readonly logger = new Logger(TripsService.name);

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
    private readonly contentService: ContentService,
    private readonly qrCodeService: QRCodeService,
  ) {}

  private getMonthlyPrices(
    branch?: Partial<Branch> | null,
  ): Record<number, number> {
    const defaults: Record<number, number> = {
      1: 45,
      2: 45,
      3: 45,
      4: 45,
      5: 45,
      6: 45,
      7: 45,
      8: 45,
      9: 45,
      10: 45,
      11: 45,
      12: 45,
    };

    const rawPrices = branch?.schoolTripMonthlyPrices;
    if (!rawPrices) {
      return defaults;
    }

    const merged = { ...defaults };
    for (const [monthKey, price] of Object.entries(rawPrices)) {
      const month = Number(monthKey);
      const normalizedPrice = Number(price);
      if (
        Number.isInteger(month) &&
        month >= 1 &&
        month <= 12 &&
        Number.isFinite(normalizedPrice) &&
        normalizedPrice >= 0
      ) {
        merged[month] = this.normalizeMoney(normalizedPrice);
      }
    }

    return merged;
  }

  private getMinimumStudents(branch?: Partial<Branch> | null): number {
    const configured = Number(branch?.schoolTripMinimumStudents);
    return Number.isInteger(configured) && configured > 0
      ? configured
      : TripsService.MINIMUM_STUDENTS;
  }

  private getDepositPercentage(branch?: Partial<Branch> | null): number {
    const configured = Number(branch?.schoolTripDepositPercentage);
    return Number.isInteger(configured) && configured >= 0 && configured <= 100
      ? configured
      : TripsService.DEPOSIT_PERCENTAGE;
  }

  private startOfDay(dateLike: Date | string): Date {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /** Parses `YYYY-MM-DD` or ISO strings without UTC day-shift surprises. */
  private parsePreferredDateParam(raw?: string | null): Date | null {
    if (raw == null || String(raw).trim() === '') return null;
    const s = String(raw).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (
        Number.isInteger(y) &&
        Number.isInteger(mo) &&
        Number.isInteger(d)
      ) {
        return new Date(y, mo - 1, d);
      }
    }
    const parsed = new Date(s);
    if (Number.isNaN(parsed.getTime())) return null;
    return this.startOfDay(parsed);
  }

  private normalizeMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private getTicketPriceForDate(
    dateLike: Date | string,
    branch?: Partial<Branch> | null,
  ): number {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    const monthlyPrices = this.getMonthlyPrices(branch);
    return (
      monthlyPrices[date.getMonth() + 1] ?? TripsService.DEFAULT_TICKET_PRICE
    );
  }

  private async buildPublicConfig(
    branch?: Partial<Branch> | null,
    preferredDate?: Date | string | null,
  ) {
    const parsedParam =
      typeof preferredDate === 'string'
        ? this.parsePreferredDateParam(preferredDate)
        : preferredDate != null
          ? this.startOfDay(preferredDate as Date)
          : null;

    const referenceDate = parsedParam ?? new Date();

    let timeSlots = [...TripsService.TIME_SLOTS];
    if (branch?.id && parsedParam != null) {
      timeSlots = await this.resolveAvailableTimeSlots(branch.id, parsedParam);
    }

    const addOns = branch?.id
      ? await this.contentService.getBranchAddOns(branch.id)
      : [];
    return {
      minimumStudents: this.getMinimumStudents(branch),
      depositPercentage: this.getDepositPercentage(branch),
      defaultTicketPricePerStudent: this.getTicketPriceForDate(
        referenceDate,
        branch,
      ),
      timeSlots,
      addOns,
      monthlyPrices: this.getMonthlyPrices(branch),
    };
  }

  async getPublicConfig(branchId?: string, preferredDate?: string) {
    const branch = branchId
      ? await this.contentService.findBranchById(branchId)
      : null;
    return this.buildPublicConfig(branch, preferredDate);
  }

  private normalizePaymentOption(value?: string | null): 'full' | 'deposit' {
    return value === 'deposit' ? 'deposit' : 'full';
  }

  private async resolveTripAddOns(
    branchId: string,
    selected?: { id?: string; quantity?: number }[] | null,
  ): Promise<ResolvedTripAddOn[]> {
    if (!selected?.length) return [];

    const catalog = await this.contentService.getBranchAddOns(branchId);
    const catalogMap = new Map(catalog.map((item) => [item.id, item]));

    return selected.map((item) => {
      const id = item.id ?? '';
      const match = catalogMap.get(id);
      if (!match) {
        throw new BadRequestException(`Unsupported school trip add-on: ${id}`);
      }

      const quantity = Number(item.quantity ?? 0);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestException(`Invalid quantity for add-on: ${id}`);
      }

      return {
        id: match.id,
        name: match.name,
        price: match.price,
        quantity,
      };
    });
  }

  private ensureTimeSlotAllowed(slot?: string | null) {
    if (!slot || !TripsService.TIME_SLOTS.includes(slot)) {
      throw new BadRequestException('Invalid school trip time slot');
    }
  }

  private resolveDurationHours(slot: string): number {
    const [start, end] = slot.split('-');
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    return Math.max(1, Math.round(minutes / 60));
  }

  private buildSlotStart(dateLike: Date | string, slot: string): Date {
    const date = this.startOfDay(dateLike);
    const [start] = slot.split('-');
    const [hour, minute] = start.split(':').map(Number);
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hour,
      minute,
      0,
      0,
    );
  }

  private buildPricing(params: {
    branch?: Partial<Branch> | null;
    studentsCount: number;
    preferredDate: Date | string;
    paymentOption: 'full' | 'deposit';
    addOns: ResolvedTripAddOn[];
  }) {
    const minimumStudents = this.getMinimumStudents(params.branch);
    const depositPercentage = this.getDepositPercentage(params.branch);
    const ticketPricePerStudent = this.getTicketPriceForDate(
      params.preferredDate,
      params.branch,
    );
    const ticketsSubtotal = this.normalizeMoney(
      params.studentsCount * ticketPricePerStudent,
    );
    const addonsSubtotal = this.normalizeMoney(
      params.addOns.reduce((sum, item) => sum + item.price * item.quantity, 0),
    );
    const totalAmount = this.normalizeMoney(ticketsSubtotal + addonsSubtotal);
    const depositAmount = this.normalizeMoney(
      totalAmount * (depositPercentage / 100),
    );
    const remainingAmount =
      params.paymentOption === 'deposit'
        ? this.normalizeMoney(totalAmount - depositAmount)
        : 0;

    const date =
      params.preferredDate instanceof Date
        ? params.preferredDate
        : new Date(params.preferredDate);

    return {
      ticketPricePerStudent,
      ticketsSubtotal,
      addonsSubtotal,
      totalAmount,
      depositAmount,
      remainingAmount,
      amountDueNow:
        params.paymentOption === 'deposit' ? depositAmount : totalAmount,
      pricingMonth: `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(
        2,
        '0',
      )}`,
      pricingSnapshot: {
        minimumStudents,
        ticketPricePerStudent,
        depositPercentage,
        timeSlots: TripsService.TIME_SLOTS,
      },
    };
  }

  /** Returns whether the slot is blocked by another trip request or a hall booking. */
  private async getSchoolTripSlotConflictReason(params: {
    branchId: string;
    preferredDate: Date;
    preferredTime: string;
    excludeRequestId?: string;
  }): Promise<'trip' | 'booking' | null> {
    const query = this.tripRepo
      .createQueryBuilder('trip')
      .where('trip.branchId = :branchId', { branchId: params.branchId })
      .andWhere('trip.preferredDate = :preferredDate', {
        preferredDate: params.preferredDate.toISOString().slice(0, 10),
      })
      .andWhere('trip.preferredTime = :preferredTime', {
        preferredTime: params.preferredTime,
      })
      .andWhere('trip.status NOT IN (:...blockedStatuses)', {
        blockedStatuses: [
          TripRequestStatus.CANCELLED,
          TripRequestStatus.REJECTED,
        ],
      });

    if (params.excludeRequestId) {
      query.andWhere('trip.id != :excludeRequestId', {
        excludeRequestId: params.excludeRequestId,
      });
    }

    const existing = await query.getOne();
    if (existing) {
      return 'trip';
    }

    const slotStart = this.buildSlotStart(
      params.preferredDate,
      params.preferredTime,
    );
    const slotEnd = new Date(
      slotStart.getTime() +
        this.resolveDurationHours(params.preferredTime) * 60 * 60 * 1000,
    );
    const bufferMs = 12 * 60 * 60 * 1000;
    const bookings = await this.bookingRepo.find({
      where: {
        branchId: params.branchId,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
        startTime: Between(
          new Date(slotStart.getTime() - bufferMs),
          new Date(slotEnd.getTime() + bufferMs),
        ),
      },
      select: ['id', 'startTime', 'durationHours'],
    });

    const conflictingBooking = bookings.find((booking) => {
      const bookingStart = new Date(booking.startTime);
      const bookingEnd = new Date(
        bookingStart.getTime() + booking.durationHours * 60 * 60 * 1000,
      );
      return bookingStart < slotEnd && bookingEnd > slotStart;
    });

    if (conflictingBooking) {
      return 'booking';
    }
    return null;
  }

  private async resolveAvailableTimeSlots(
    branchId: string,
    day: Date,
  ): Promise<string[]> {
    const preferredDate = this.startOfDay(day);
    const available: string[] = [];
    for (const slot of TripsService.TIME_SLOTS) {
      const reason = await this.getSchoolTripSlotConflictReason({
        branchId,
        preferredDate,
        preferredTime: slot,
      });
      if (reason == null) {
        available.push(slot);
      }
    }
    return available;
  }

  private async ensureNoConflict(params: {
    branchId: string;
    preferredDate: Date;
    preferredTime: string;
    excludeRequestId?: string;
  }) {
    const reason = await this.getSchoolTripSlotConflictReason(params);
    if (reason === 'trip') {
      throw new BadRequestException(
        'This school trip slot is already booked for the selected day',
      );
    }
    if (reason === 'booking') {
      throw new BadRequestException(
        'This school trip slot conflicts with an existing booking',
      );
    }
  }

  async createRequest(userId: string, dto: CreateTripRequestDto) {
    const branch = await this.contentService.findBranchById(dto.branchId);
    if (!branch.hasSchoolTrips) {
      throw new BadRequestException(
        'This branch does not accept school trip booking requests',
      );
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const studentsCount = Number(dto.studentsCount ?? 0);
    const minimumStudents = this.getMinimumStudents(branch);
    if (!Number.isInteger(studentsCount) || studentsCount < minimumStudents) {
      throw new BadRequestException(
        `School trips require at least ${minimumStudents} students`,
      );
    }

    this.ensureTimeSlotAllowed(dto.preferredTime);

    const preferredDate = this.startOfDay(dto.preferredDate);
    const paymentOption = this.normalizePaymentOption(dto.paymentOption);
    const resolvedAddOns = await this.resolveTripAddOns(
      dto.branchId,
      dto.addOns as any,
    );
    const pricing = this.buildPricing({
      branch,
      studentsCount,
      preferredDate,
      paymentOption,
      addOns: resolvedAddOns,
    });

    await this.ensureNoConflict({
      branchId: dto.branchId,
      preferredDate,
      preferredTime: dto.preferredTime!,
    });

    const req = this.tripRepo.create({
      requesterId: userId,
      branchId: dto.branchId,
      schoolName: dto.schoolName,
      contactPersonName: user.name,
      contactPhone: user.phone || '',
      contactEmail: user.email,
      studentsCount,
      accompanyingAdults: dto.accompanyingAdults ?? 0,
      preferredDate,
      preferredTime: dto.preferredTime!,
      selectedTimeSlot: dto.preferredTime!,
      durationHours: this.resolveDurationHours(dto.preferredTime!),
      specialRequirements: dto.specialRequirements,
      addOns: resolvedAddOns as any,
      status: TripRequestStatus.APPROVED,
      quotedPrice: pricing.totalAmount,
      ticketPricePerStudent: pricing.ticketPricePerStudent,
      ticketsSubtotal: pricing.ticketsSubtotal,
      addonsSubtotal: pricing.addonsSubtotal,
      totalAmount: pricing.totalAmount,
      paymentOption,
      depositAmount: pricing.depositAmount,
      amountPaid: 0,
      remainingAmount:
        paymentOption === 'deposit'
          ? pricing.remainingAmount
          : pricing.totalAmount,
      pricingMonth: pricing.pricingMonth,
      pricingSnapshot: pricing.pricingSnapshot as any,
    });
    const saved = await this.tripRepo.save(req);
    return { id: saved.id, request: saved };
  }

  async getRequest(user: any, id: string) {
    const req = await this.tripRepo.findOne({
      where: { id },
      relations: ['branch', 'requester'],
    });
    if (!req) throw new NotFoundException('Request not found');
    const isOwner = req.requesterId === user.id;
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isOwner && !isStaff) throw new ForbiddenException('Not allowed');
    return req;
  }

  async submitRequest(userId: string, id: string, dto: SubmitTripRequestDto) {
    const req = await this.tripRepo.findOne({
      where: { id, requesterId: userId },
    });
    if (!req) throw new NotFoundException('Request not found');
    return { success: true, status: req.status };
  }

  async approveRequest(
    approverId: string,
    id: string,
    quotedPrice?: number,
    adminNotes?: string,
  ) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (adminNotes) req.adminNotes = adminNotes;
    if (quotedPrice !== undefined) {
      req.totalAmount = quotedPrice;
      req.quotedPrice = quotedPrice;
    }
    req.status = TripRequestStatus.APPROVED;
    req.approvedAt = new Date();
    req.approvedBy = approverId;
    await this.tripRepo.save(req);
    return { success: true, quotedPrice: req.totalAmount ?? req.quotedPrice };
  }

  async uploadParticipants(
    userId: string,
    id: string,
    file: Express.Multer.File,
    userRoles?: string[],
  ) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    const isOwner = req.requesterId === userId;
    const roles = userRoles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isOwner && !isStaff) {
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
        throw new BadRequestException(
          `Invalid row ${idx + 2}: name and guardianPhone are required`,
        );
      }
      return {
        name: String(r.name).trim(),
        age: Number(r.age || 0),
        guardianName: String(r.guardianName || '').trim(),
        guardianPhone: String(r.guardianPhone).trim(),
      };
    });

    req.studentsList = participants;
    req.studentsCount = participants.length;
    req.excelFilePath = file.path;
    await this.tripRepo.save(req);
    return { count: participants.length };
  }

  async getTemplate(): Promise<Buffer> {
    const ws = XLSX.utils.json_to_sheet([
      {
        name: 'الطالب 1',
        age: 10,
        guardianName: 'ولي الأمر 1',
        guardianPhone: '0500000000',
      },
      {
        name: 'الطالب 2',
        age: 11,
        guardianName: 'ولي الأمر 2',
        guardianPhone: '0500000001',
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async createInvoice(
    approverId: string,
    id: string,
    dto: InvoiceTripRequestDto,
  ) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    const total =
      dto.overrideAmount ?? Number(req.totalAmount ?? req.quotedPrice ?? 0);
    req.quotedPrice = total;
    req.totalAmount = total;
    await this.tripRepo.save(req);
    return {
      invoiceId: req.invoiceId ?? `trip_${req.id}`,
      amount: total,
      currency: dto.currency || 'SAR',
    };
  }

  async issueTickets(issuerId: string, id: string, dto: IssueTicketsDto) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    const allowedStatuses = [
      TripRequestStatus.DEPOSIT_PAID,
      TripRequestStatus.PAID,
      TripRequestStatus.COMPLETED,
    ];
    if (!allowedStatuses.includes(req.status)) {
      throw new BadRequestException(
        'Tickets can be issued only after deposit or full payment',
      );
    }

    // Check if tickets already exist for this trip request to avoid duplicates
    const existingBooking = await this.bookingRepo
      .createQueryBuilder('booking')
      .where("booking.metadata->>'tripRequestId' = :id", { id: req.id })
      .andWhere('booking.status != :cancelled', {
        cancelled: BookingStatus.CANCELLED,
      })
      .getOne();

    if (existingBooking) {
      this.logger.log(`Booking already exists for trip request ${id}`);
      return { bookingId: existingBooking.id, ticketsCount: 1 };
    }

    const studentsCount = req.studentsCount || 0;
    const adultsCount = req.accompanyingAdults || 0;
    const totalPersons = studentsCount + adultsCount;
    const totalAmount = Number(req.totalAmount ?? req.quotedPrice ?? 0);
    const issuer = await this.userRepo.findOne({ where: { id: issuerId } });

    // Fetch requester (account holder) info for the ticket
    const requester = await this.userRepo.findOne({
      where: { id: req.requesterId },
    });

    const booking = this.bookingRepo.create({
      userId: req.requesterId,
      branchId: req.branchId || issuer?.branchId,
      startTime: new Date(dto.startTime),
      durationHours: dto.durationHours,
      persons: totalPersons as any,
      totalPrice: totalAmount as any,
      status: BookingStatus.CONFIRMED,
      addOns: (req.addOns || []).map((item: any) => ({
        id: item.id,
        name: item.name ?? '',
        price: Number(item.price ?? 0),
        quantity: Number(item.quantity ?? 1),
      })),
      metadata: {
        tripType: 'school',
        tripRequestId: req.id,
      },
    } as Partial<Booking>);
    const savedBooking = await this.bookingRepo.save(booking);

    // QR payload is the plain string `trip_<bookingId>`. BookingsService hashes it
    // with sha256 before lookup — same as all other tickets (see getTicketByToken).
    const tripQrPayload = `trip_${savedBooking.id}`;
    const tripQrTokenHash = this.qrCodeService.generateQRTokenHash(tripQrPayload);

    // Single ticket for the entire school trip booking
    const ticket = this.ticketRepo.create({
      bookingId: savedBooking.id,
      qrTokenHash: tripQrTokenHash,
      status: TicketStatus.VALID,
      personCount: totalPersons,
      holderName: requester?.name || req.schoolName,
      holderPhone: requester?.phone || undefined,
      metadata: {
        tripType: 'school',
        schoolName: req.schoolName,
        studentsCount,
        adultsCount,
        totalPersons,
        preferredDate: req.preferredDate?.toISOString?.() ?? req.preferredDate,
        preferredTime: req.preferredTime,
        addOns: req.addOns || [],
        ticketsSubtotal: Number(req.ticketsSubtotal ?? 0),
        addonsSubtotal: Number(req.addonsSubtotal ?? 0),
        totalAmount,
        paymentOption: req.paymentOption,
      },
    } as Partial<Ticket>);

    await this.ticketRepo.save(ticket);
    if (req.status === TripRequestStatus.PAID) {
      req.status = TripRequestStatus.COMPLETED;
    }
    await this.tripRepo.save(req);

    await this.notifications.enqueue({
      type: 'TICKETS_ISSUED',
      to: { userId: req.requesterId },
      data: { bookingId: savedBooking.id, welcomeMessage: dto.welcomeMessage },
      lang: 'ar',
      channels: ['sms', 'push'],
    });

    return { bookingId: savedBooking.id, ticketsCount: 1 };
  }

  async markPaid(approverId: string, id: string, dto: any) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');

    req.status = TripRequestStatus.PAID;
    req.paymentMethod = PaymentMethod.CASH;
    req.amountPaid = Number(req.totalAmount ?? req.quotedPrice ?? 0);
    req.remainingAmount = 0;
    await this.tripRepo.save(req);

    const startTime = this.buildSlotStart(
      req.preferredDate,
      req.selectedTimeSlot || req.preferredTime || TripsService.TIME_SLOTS[0],
    );
    return this.issueTickets(approverId, id, {
      startTime: startTime.toISOString(),
      durationHours: req.durationHours || 2,
      welcomeMessage: dto?.reference,
    });
  }

  async rejectRequest(
    approverId: string,
    id: string,
    dto: RejectTripRequestDto,
  ) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    req.status = TripRequestStatus.REJECTED;
    req.rejectionReason = dto.rejectionReason;
    if (dto.adminNotes) req.adminNotes = dto.adminNotes;
    req.approvedBy = approverId;
    await this.tripRepo.save(req);
    return { success: true };
  }

  async cancelRequest(userId: string, id: string, dto: CancelTripRequestDto) {
    const req = await this.tripRepo.findOne({
      where: { id, requesterId: userId },
    });
    if (!req) throw new NotFoundException('Request not found');

    if (
      [TripRequestStatus.PAID, TripRequestStatus.COMPLETED].includes(req.status)
    ) {
      throw new BadRequestException('Paid school trips cannot be cancelled');
    }

    req.status = TripRequestStatus.CANCELLED;
    if (dto.reason) req.rejectionReason = dto.reason;
    await this.tripRepo.save(req);
    return { success: true };
  }

  async updateRequest(userId: string, id: string, dto: UpdateTripRequestDto) {
    const req = await this.tripRepo.findOne({
      where: { id, requesterId: userId },
    });
    if (!req) throw new NotFoundException('Request not found');

    if (
      ![TripRequestStatus.APPROVED, TripRequestStatus.DEPOSIT_PAID].includes(
        req.status,
      )
    ) {
      throw new BadRequestException(
        'Only active school trip bookings can be updated',
      );
    }

    const nextBranchId = dto.branchId ?? req.branchId;
    const nextBranch = await this.contentService.findBranchById(nextBranchId);
    if (!nextBranch.hasSchoolTrips) {
      throw new BadRequestException(
        'This branch does not accept school trip booking requests',
      );
    }

    const nextStudentsCount = dto.studentsCount ?? req.studentsCount;
    const minimumStudents = this.getMinimumStudents(nextBranch);
    if (nextStudentsCount < minimumStudents) {
      throw new BadRequestException(
        `School trips require at least ${minimumStudents} students`,
      );
    }

    const nextPreferredDate =
      dto.preferredDate !== undefined
        ? this.startOfDay(dto.preferredDate)
        : req.preferredDate;
    const nextTimeSlot =
      dto.preferredTime ?? req.selectedTimeSlot ?? req.preferredTime;
    this.ensureTimeSlotAllowed(nextTimeSlot);

    await this.ensureNoConflict({
      branchId: nextBranchId,
      preferredDate: nextPreferredDate,
      preferredTime: nextTimeSlot!,
      excludeRequestId: req.id,
    });

    const resolvedAddOns = await this.resolveTripAddOns(
      nextBranchId,
      (dto.addOns as any) ?? req.addOns,
    );
    const paymentOption = this.normalizePaymentOption(
      dto.paymentOption ?? req.paymentOption,
    );
    const pricing = this.buildPricing({
      branch: nextBranch,
      studentsCount: nextStudentsCount,
      preferredDate: nextPreferredDate,
      paymentOption,
      addOns: resolvedAddOns,
    });

    if (dto.branchId !== undefined) req.branchId = dto.branchId;
    if (dto.schoolName !== undefined) req.schoolName = dto.schoolName;
    req.studentsCount = nextStudentsCount;
    if (dto.accompanyingAdults !== undefined) {
      req.accompanyingAdults = dto.accompanyingAdults;
    }
    req.preferredDate = nextPreferredDate as any;
    req.preferredTime = nextTimeSlot!;
    req.selectedTimeSlot = nextTimeSlot!;
    req.durationHours = this.resolveDurationHours(nextTimeSlot!);
    if (dto.specialRequirements !== undefined)
      req.specialRequirements = dto.specialRequirements;
    req.addOns = resolvedAddOns as any;
    req.paymentOption = paymentOption;
    req.ticketPricePerStudent = pricing.ticketPricePerStudent;
    req.ticketsSubtotal = pricing.ticketsSubtotal;
    req.addonsSubtotal = pricing.addonsSubtotal;
    req.totalAmount = pricing.totalAmount;
    req.quotedPrice = pricing.totalAmount;
    req.depositAmount = pricing.depositAmount;
    req.pricingMonth = pricing.pricingMonth;
    req.pricingSnapshot = pricing.pricingSnapshot as any;
    req.remainingAmount = this.normalizeMoney(
      pricing.totalAmount - Number(req.amountPaid ?? 0),
    );

    return this.tripRepo.save(req);
  }

  async findUserRequests(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
  ) {
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
  ) {
    const where: any = {};
    if (filters?.status) where.status = filters.status as any;
    if (filters?.from && filters?.to) {
      where.preferredDate = {} as any;
      where.preferredDate.$gte = new Date(filters.from) as any;
      where.preferredDate.$lte = new Date(filters.to) as any;
    }

    const [requests, total] = await this.tripRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    } as any);

    const paidList = await this.tripRepo.find({
      where: { ...where, status: 'paid' as any },
    });
    const completedList = await this.tripRepo.find({
      where: { ...where, status: 'completed' as any },
    });
    const totalRevenue = [...paidList, ...completedList]
      .map((r) => Number(r.totalAmount || r.quotedPrice || 0))
      .reduce((a, b) => a + b, 0);

    return {
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total,
        pending: await this.tripRepo.count({
          where: { ...where, status: 'approved' as any },
        }),
        approved: await this.tripRepo.count({
          where: { ...where, status: 'approved' as any },
        }),
        completed: await this.tripRepo.count({
          where: { ...where, status: 'completed' as any },
        }),
        totalRevenue,
      },
    };
  }

  async payForTrip(
    userId: string,
    id: string,
    dto: { paymentMethod?: string },
  ) {
    const req = await this.tripRepo.findOne({
      where: { id, requesterId: userId },
    });
    if (!req) throw new NotFoundException('Request not found');

    const totalAmount = Number(req.totalAmount ?? req.quotedPrice ?? 0);
    if (totalAmount <= 0) {
      throw new BadRequestException('No school trip amount available');
    }

    const amountDueNow =
      req.paymentOption === 'deposit' && Number(req.amountPaid ?? 0) <= 0
        ? Number(req.depositAmount ?? 0)
        : Number(req.remainingAmount ?? totalAmount);

    req.amountPaid = this.normalizeMoney(
      Number(req.amountPaid ?? 0) + amountDueNow,
    );
    req.remainingAmount = this.normalizeMoney(
      totalAmount - Number(req.amountPaid ?? 0),
    );
    req.paymentMethod = dto.paymentMethod as any;

    if (req.remainingAmount > 0) {
      req.status = TripRequestStatus.DEPOSIT_PAID;
      await this.tripRepo.save(req);

      const startTime = this.buildSlotStart(
        req.preferredDate,
        req.selectedTimeSlot || req.preferredTime || TripsService.TIME_SLOTS[0],
      );
      const ticketsResult = await this.issueTickets(userId, id, {
        startTime: startTime.toISOString(),
        durationHours: req.durationHours || 2,
        welcomeMessage: `مرحباً بكم في الرحلة المدرسية - ${req.schoolName}`,
      });

      return {
        success: true,
        status: TripRequestStatus.DEPOSIT_PAID,
        paidAmount: amountDueNow,
        remainingAmount: req.remainingAmount,
        bookingId: ticketsResult.bookingId,
        ticketsCount: ticketsResult.ticketsCount,
      };
    }

    req.status = TripRequestStatus.PAID;
    await this.tripRepo.save(req);
    const startTime = this.buildSlotStart(
      req.preferredDate,
      req.selectedTimeSlot || req.preferredTime || TripsService.TIME_SLOTS[0],
    );
    const ticketsResult = await this.issueTickets(userId, id, {
      startTime: startTime.toISOString(),
      durationHours: req.durationHours || 2,
      welcomeMessage: `مرحباً بكم في الرحلة المدرسية - ${req.schoolName}`,
    });

    return {
      success: true,
      status: 'PAID_AND_COMPLETED',
      paidAmount: amountDueNow,
      bookingId: ticketsResult.bookingId,
      ticketsCount: ticketsResult.ticketsCount,
    };
  }

  async getTripTickets(tripRequestId: string, user: any): Promise<Ticket[]> {
    const tripRequest = await this.tripRepo.findOne({
      where: { id: tripRequestId },
    });
    if (!tripRequest) throw new NotFoundException('Trip request not found');

    const isOwner = tripRequest.requesterId === user.id;
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isOwner && !isStaff) throw new ForbiddenException('Not allowed');

    const payment = await this.paymentRepo.findOne({
      where: {
        tripRequestId: tripRequestId,
        status: PaymentStatus.COMPLETED,
      },
      order: { createdAt: 'DESC' },
    });

    if (payment?.bookingId) {
      const paidBookingTickets = await this.ticketRepo.find({
        where: { bookingId: payment.bookingId },
        relations: ['staff'],
      });
      if (paidBookingTickets.length > 0) return paidBookingTickets;
    }

    // 1. Direct and most reliable lookup by tripRequestId in metadata
    const bookingByMetadata = await this.bookingRepo
      .createQueryBuilder('booking')
      .where("booking.metadata->>'tripRequestId' = :id", { id: tripRequest.id })
      .andWhere('booking.status != :cancelled', {
        cancelled: BookingStatus.CANCELLED,
      })
      .getOne();

    if (bookingByMetadata) {
      const tickets = await this.ticketRepo.find({
        where: { bookingId: bookingByMetadata.id },
        relations: ['staff'],
      });
      if (tickets.length > 0) return tickets;
    }

    // 2. Fallback to recent bookings for older requests or if metadata lookup fails
    const recentBookings = await this.bookingRepo.find({
      where: {
        userId: tripRequest.requesterId,
        branchId: tripRequest.branchId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.PENDING]) as any,
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    for (const booking of recentBookings) {
      if ((booking as any)?.metadata?.tripRequestId === tripRequest.id) {
        const bookingTickets = await this.ticketRepo.find({
          where: { bookingId: booking.id },
          relations: ['staff'],
        });
        if (bookingTickets.length > 0) return bookingTickets;
      }
    }

    const slot = tripRequest.selectedTimeSlot || tripRequest.preferredTime;
    const bookingStart = slot
      ? this.buildSlotStart(tripRequest.preferredDate, slot)
      : tripRequest.preferredDate;
    const bookings = await this.bookingRepo.find({
      where: {
        userId: tripRequest.requesterId,
        branchId: tripRequest.branchId,
        startTime: bookingStart,
        status: BookingStatus.CONFIRMED,
      },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    if (!bookings.length) return [];

    for (const booking of bookings) {
      const bookingTickets = await this.ticketRepo.find({
        where: { bookingId: booking.id },
        relations: ['staff'],
      });
      if (bookingTickets.length > 0) {
        return bookingTickets;
      }
    }

    return [];
  }
}
