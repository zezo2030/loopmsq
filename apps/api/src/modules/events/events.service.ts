import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  EventRequest,
  EventRequestStatus,
} from '../../database/entities/event-request.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { CreateEventRequestDto } from './dto/create-event-request.dto';
import { QuoteEventRequestDto } from './dto/quote-event-request.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ContentService } from '../content/content.service';
import { AdminConfigService } from '../admin-config/admin-config.service';
import { resolveEventTicketWindow } from '../../utils/event-ticket-window.util';
import * as crypto from 'crypto';

type ResolvedEventAddon = {
  id: string;
  name: string;
  category?: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  quantity: number;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  private static readonly BASE_HALL_RENTAL_PRICE = 200;
  private static readonly DEPOSIT_PERCENTAGE = 20;
  private static readonly MAX_PERSONS = 7;
  private static readonly FIXED_DURATION_HOURS = 2;
  private static readonly TIME_SLOTS = [
    '16:00-18:00',
    '19:00-21:00',
    '22:00-00:00',
  ] as const;

  private static readonly EVENT_ADDON_CATEGORIES = [
    'event_private',
    'event_balloon',
    'event_cake',
    'event_decor',
  ] as const;

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
    private readonly adminConfigService: AdminConfigService,
  ) {}

  async getPublicConfig(branchId?: string, date?: string) {
    const addOns = await this.getEventAddOnCatalog(branchId);
    const privateEventTerms =
      await this.adminConfigService.getPrivateEventTermsConfig();
    let timeSlots: string[] = [...EventsService.TIME_SLOTS];
    let bookedTimeSlots: string[] = [];

    if (branchId && date) {
      const availability = await this.getAvailableSlotsForDate(branchId, date);
      timeSlots = availability.availableSlots;
      bookedTimeSlots = availability.bookedSlots;
    }

    return {
      baseHallRentalPrice: EventsService.BASE_HALL_RENTAL_PRICE,
      depositPercentage: EventsService.DEPOSIT_PERCENTAGE,
      maxPersons: EventsService.MAX_PERSONS,
      durationHours: EventsService.FIXED_DURATION_HOURS,
      timeSlots,
      bookedTimeSlots,
      terms: privateEventTerms.terms,
      addOns,
    };
  }

  private async getAvailableSlotsForDate(branchId: string, date: string) {
    const normalizedDate = String(date).split('T')[0].trim();
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(normalizedDate)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    this.logger.log(
      `Checking slot availability for branch ${branchId} on date ${normalizedDate}`,
    );

    const availableSlots: string[] = [];
    const bookedSlots: string[] = [];

    for (const slot of EventsService.TIME_SLOTS) {
      const { startTime, endTime } = this.buildSlotWindow(normalizedDate, slot);
      const isBooked = await this.hasSlotConflict(branchId, startTime, endTime);

      this.logger.log(
        `Slot ${slot}: ${isBooked ? 'BOOKED' : 'AVAILABLE'} (checking ${startTime.toISOString()} - ${endTime.toISOString()})`,
      );

      if (isBooked) {
        bookedSlots.push(slot);
      } else {
        availableSlots.push(slot);
      }
    }

    this.logger.log(
      `Result - Available: ${availableSlots.join(', ')}, Booked: ${bookedSlots.join(', ')}`,
    );

    return { availableSlots, bookedSlots };
  }

  private async hasSlotConflict(
    branchId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<boolean> {
    const activeEventStatuses = [
      EventRequestStatus.QUOTED,
      EventRequestStatus.PAID,
      EventRequestStatus.DEPOSIT_PAID,
      EventRequestStatus.CONFIRMED,
    ];
    const activeBookingStatuses = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.COMPLETED,
    ];

    this.logger.debug(
      `Checking conflicts for branch ${branchId}, slot ${startTime.toISOString()} - ${endTime.toISOString()}`,
    );

    const conflictingEvent = await this.eventRepo
      .createQueryBuilder('event')
      .where('event.branchId = :branchId', { branchId })
      .andWhere('event.status IN (:...statuses)', {
        statuses: activeEventStatuses,
      })
      .andWhere('event.startTime < :endTime', { endTime })
      .andWhere(
        '(event.startTime + make_interval(hours => event.durationHours)) > :startTime',
        { startTime },
      )
      .getOne();

    if (conflictingEvent) {
      this.logger.log(
        `Found conflicting event ${conflictingEvent.id} (status: ${conflictingEvent.status}, startTime: ${conflictingEvent.startTime}, duration: ${conflictingEvent.durationHours}h) blocking slot`,
      );
      return true;
    }

    const conflictingBooking = await this.bookingRepo
      .createQueryBuilder('booking')
      .where('booking.branchId = :branchId', { branchId })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: activeBookingStatuses,
      })
      .andWhere('booking.startTime < :endTime', { endTime })
      .andWhere(
        '(booking.startTime + make_interval(hours => booking.durationHours)) > :startTime',
        { startTime },
      )
      .getOne();

    if (conflictingBooking) {
      this.logger.log(
        `Found conflicting booking ${conflictingBooking.id} (status: ${conflictingBooking.status}, startTime: ${conflictingBooking.startTime}, duration: ${conflictingBooking.durationHours}h) blocking slot`,
      );
      return true;
    }

    this.logger.debug('No conflicts found for this slot');
    return false;
  }

  async createRequest(userId: string, dto: CreateEventRequestDto) {
    const branch = await this.contentService.findBranchById(dto.branchId);
    if (!branch.hasEventBookings) {
      throw new BadRequestException(
        'This branch does not accept special event booking requests',
      );
    }
    const existingQuotedRequest = await this.eventRepo.findOne({
      where: {
        requesterId: userId,
        branchId: dto.branchId,
        status: EventRequestStatus.QUOTED,
      },
      order: { createdAt: 'DESC' },
    });
    if (existingQuotedRequest) {
      throw new BadRequestException({
        message:
          'You already have a quoted private event request for this branch. Please complete payment first.',
        code: 'EVENT_REQUEST_PAYMENT_PENDING',
        eventRequestId: existingQuotedRequest.id,
      });
    }
    if (!dto.acceptedTerms) {
      throw new BadRequestException('Terms and conditions must be accepted');
    }
    if (dto.persons > EventsService.MAX_PERSONS) {
      throw new BadRequestException(
        `Private event booking allows up to ${EventsService.MAX_PERSONS} persons only`,
      );
    }
    if (
      dto.durationHours !== EventsService.FIXED_DURATION_HOURS ||
      !EventsService.TIME_SLOTS.includes(dto.selectedTimeSlot as any)
    ) {
      throw new BadRequestException('Invalid private event time slot');
    }

    const { startTime, endTime } = this.buildSlotWindow(
      dto.startTime,
      dto.selectedTimeSlot,
    );
    await this.ensureNoConflict(dto.branchId, startTime, endTime);

    const resolvedAddOns = await this.resolveSelectedAddOns(
      dto.branchId,
      dto.addOns,
    );
    const addOnsSubtotal = this.normalizeMoney(
      resolvedAddOns.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0,
      ),
    );
    const totalAmount = this.normalizeMoney(
      EventsService.BASE_HALL_RENTAL_PRICE + addOnsSubtotal,
    );
    const depositAmount = this.normalizeMoney(
      totalAmount * (EventsService.DEPOSIT_PERCENTAGE / 100),
    );
    const remainingAmount =
      dto.paymentOption === 'deposit'
        ? this.normalizeMoney(totalAmount - depositAmount)
        : 0;

    const req = this.eventRepo.create({
      requesterId: userId,
      type: dto.type,
      decorated:
        resolvedAddOns.some((item) => item.category === 'event_decor') ||
        dto.decorated ||
        false,
      branchId: dto.branchId,
      startTime,
      durationHours: EventsService.FIXED_DURATION_HOURS,
      selectedTimeSlot: dto.selectedTimeSlot,
      persons: dto.persons,
      addOns: resolvedAddOns as any,
      notes: dto.notes,
      acceptedTerms: true,
      status: EventRequestStatus.QUOTED,
      quotedPrice: totalAmount,
      hallRentalPrice: EventsService.BASE_HALL_RENTAL_PRICE,
      addOnsSubtotal,
      totalAmount,
      paymentOption: dto.paymentOption,
      depositAmount,
      amountPaid: 0,
      remainingAmount,
      paymentMethod: dto.paymentMethod,
    });
    const saved = await this.eventRepo.save(req);

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

    if (req.branchId) {
      try {
        const branch = await this.contentService.findBranchById(req.branchId);
        (req as any).branch = branch;
      } catch (error) {
        this.logger.error(
          `Failed to load branch ${req.branchId} for event request ${req.id}`,
          error,
        );
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

    for (const request of requests) {
      if (request.branchId) {
        try {
          const branch = await this.contentService.findBranchById(
            request.branchId,
          );
          (request as any).branch = branch;
        } catch (error) {
          this.logger.error(
            `Failed to load branch ${request.branchId} for event request ${request.id}`,
            error,
          );
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
    if (
      ![
        EventRequestStatus.SUBMITTED,
        EventRequestStatus.UNDER_REVIEW,
        EventRequestStatus.QUOTED,
      ].includes(req.status)
    ) {
      throw new BadRequestException('Request is not in a quotable state');
    }

    const base =
      dto.basePrice ?? Number(req.hallRentalPrice ?? req.quotedPrice ?? 0);
    const addOnsTotal = this.normalizeMoney(
      (req.addOns || []).reduce((s, a) => s + a.price * a.quantity, 0),
    );
    const total = this.normalizeMoney(base + addOnsTotal);
    const depositAmount = this.normalizeMoney(
      total * (EventsService.DEPOSIT_PERCENTAGE / 100),
    );
    const paymentOption = req.paymentOption === 'deposit' ? 'deposit' : 'full';

    req.hallRentalPrice = base;
    req.addOnsSubtotal = addOnsTotal;
    req.quotedPrice = total;
    req.totalAmount = total;
    req.depositAmount = depositAmount;
    req.remainingAmount =
      paymentOption === 'deposit'
        ? this.normalizeMoney(total - depositAmount)
        : 0;
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
    if (
      ![
        EventRequestStatus.PAID,
        EventRequestStatus.DEPOSIT_PAID,
        EventRequestStatus.CONFIRMED,
      ].includes(req.status)
    ) {
      throw new BadRequestException(
        'Event cannot be confirmed before successful payment',
      );
    }

    if (req.status !== EventRequestStatus.CONFIRMED) {
      const hasCompletedPayment = await this.paymentRepo.exist({
        where: {
          eventRequestId: req.id,
          status: PaymentStatus.COMPLETED,
        },
      });
      if (!hasCompletedPayment) {
        throw new BadRequestException(
          'Event cannot be confirmed before successful payment',
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const totalAmount = Number(
        req.totalAmount ?? req.quotedPrice ?? req.hallRentalPrice ?? 0,
      );
      if (totalAmount <= 0) {
        throw new BadRequestException('Event request has no payable amount');
      }

      let savedBooking: Booking | null = null;
      if (req.bookingId) {
        savedBooking = await queryRunner.manager.findOne(Booking, {
          where: { id: req.bookingId },
        });
      }

      if (!savedBooking) {
        savedBooking = await this.createBookingArtifacts(queryRunner, req);
        req.bookingId = savedBooking.id;
      }

      req.status =
        Number(req.remainingAmount ?? 0) > 0
          ? EventRequestStatus.DEPOSIT_PAID
          : EventRequestStatus.CONFIRMED;
      await queryRunner.manager.save(req);
      await queryRunner.commitTransaction();

      await this.notifications.enqueue({
        type: 'EVENT_STATUS',
        to: { userId: req.requesterId },
        data: { status: req.status.toUpperCase(), bookingId: savedBooking.id },
        channels: ['sms', 'push'],
      });

      return { success: true, bookingId: savedBooking.id, status: req.status };
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
    filters?: {
      status?: string;
      type?: string;
      branchId?: string;
      from?: string;
      to?: string;
    },
  ): Promise<{
    requests: EventRequest[];
    total: number;
    page: number;
    totalPages: number;
    stats: {
      total: number;
      pending: number;
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
      where.startTime = In([
        new Date(filters.from) as any,
        new Date(filters.to) as any,
      ]) as any;
    }

    const [requests, total] = await this.eventRepo.findAndCount({
      where,
      relations: ['requester'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    } as any);

    for (const request of requests) {
      if (request.branchId) {
        try {
          const branch = await this.contentService.findBranchById(
            request.branchId,
          );
          (request as any).branch = branch;
        } catch (error) {
          this.logger.error(
            `Failed to load branch ${request.branchId} for event request ${request.id}`,
            error,
          );
        }
      }
    }

    const pending = await this.eventRepo.count({
      where: [
        { ...where, status: EventRequestStatus.SUBMITTED },
        { ...where, status: EventRequestStatus.UNDER_REVIEW },
      ] as any,
    });
    const quoted = await this.eventRepo.count({
      where: { ...where, status: EventRequestStatus.QUOTED },
    });
    const confirmed = await this.eventRepo.count({
      where: [
        { ...where, status: EventRequestStatus.CONFIRMED },
        { ...where, status: EventRequestStatus.DEPOSIT_PAID },
      ] as any,
    });
    const revenueRows = await this.eventRepo.find({
      where: [
        { ...where, status: EventRequestStatus.CONFIRMED },
        { ...where, status: EventRequestStatus.DEPOSIT_PAID },
      ],
    });
    const totalRevenue = revenueRows.reduce(
      (sum, row) => sum + Number(row.amountPaid ?? 0),
      0,
    );

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
    const eventRequest = await this.eventRepo.findOne({
      where: { id: eventRequestId },
    });
    if (!eventRequest) throw new NotFoundException('Event request not found');

    const isOwner = eventRequest.requesterId === user.id;
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isOwner && !isStaff) throw new ForbiddenException('Not allowed');

    if (eventRequest.bookingId) {
      return this.ticketRepo.find({
        where: { bookingId: eventRequest.bookingId },
      });
    }

    const payment = await this.paymentRepo.findOne({
      where: {
        eventRequestId,
        status: PaymentStatus.COMPLETED,
      },
      order: { createdAt: 'DESC' },
    });

    const bookingId = payment?.bookingId ?? undefined;
    if (!bookingId) return [];

    return this.ticketRepo.find({
      where: { bookingId },
    });
  }

  private async getEventAddOnCatalog(branchId?: string) {
    const catalog = await this.contentService.getBranchAddOns(branchId);
    const eventCatalog = catalog.filter(
      (item) =>
        item.metadata?.privateEventAddon === true ||
        EventsService.EVENT_ADDON_CATEGORIES.includes(
          (item.category ||
            'general') as (typeof EventsService.EVENT_ADDON_CATEGORIES)[number],
        ),
    );
    return eventCatalog;
  }

  private async resolveSelectedAddOns(
    branchId: string,
    selected?: Array<{
      id?: string;
      name?: string;
      price?: number;
      quantity?: number;
      category?: string;
      description?: string;
      imageUrl?: string;
      selectedColors?: string;
    }> | null,
  ): Promise<ResolvedEventAddon[]> {
    if (!selected?.length) return [];
    const catalog = await this.getEventAddOnCatalog(branchId);
    const catalogMap = new Map<string, (typeof catalog)[number]>(
      catalog.map((item) => [item.id, item] as const),
    );

    return selected.map((item) => {
      const id = String(item.id ?? '');
      const quantity = Math.max(1, Number(item.quantity ?? 1));
      const found = catalogMap.get(id);
      if (!found) {
        throw new BadRequestException(`Invalid event add-on: ${id}`);
      }
      return {
        ...item,
        id: found.id,
        name: found.name,
        category: found.category,
        description: found.description,
        imageUrl: found.imageUrl,
        price: Number(found.price),
        quantity,
        metadata: found.metadata ?? null,
      };
    });
  }

  private buildSlotWindow(dateInput: string, slot: string) {
    const normalizedDate = String(dateInput).split('T')[0].trim();
    const [year, month, day] = normalizedDate.split('-').map(Number);
    if (!year || !month || !day) {
      throw new BadRequestException('Invalid private event date');
    }

    const [start, end] = slot.split('-');
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHourRaw, endMinute] = end.split(':').map(Number);
    const endHour = endHourRaw === 0 ? 24 : endHourRaw;

    const startStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}:00+03:00`;
    const endStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00+03:00`;

    const startTime = new Date(startStr);
    const endTime = new Date(endStr);

    this.logger.debug(
      `buildSlotWindow: date=${normalizedDate}, slot=${slot}, startTime=${startTime.toISOString()}, endTime=${endTime.toISOString()}`,
    );

    return { startTime, endTime };
  }

  private async ensureNoConflict(
    branchId: string,
    startTime: Date,
    endTime: Date,
  ) {
    const isBooked = await this.hasSlotConflict(branchId, startTime, endTime);
    if (isBooked) {
      throw new BadRequestException('هذا الموعد محجوز بالفعل');
    }
  }

  private async createBookingArtifacts(
    queryRunner: any,
    req: EventRequest,
  ): Promise<Booking> {
    const booking = queryRunner.manager.create(Booking, {
      userId: req.requesterId,
      branchId: req.branchId,
      startTime: req.startTime,
      durationHours: req.durationHours,
      persons: req.persons,
      totalPrice: req.totalAmount || req.quotedPrice || 0,
      status: BookingStatus.CONFIRMED,
      addOns: req.addOns,
      specialRequests: req.notes,
      metadata: {
        eventRequestId: req.id,
        eventType: req.type,
        selectedTimeSlot: req.selectedTimeSlot,
        paymentOption: req.paymentOption,
        amountPaid: Number(req.amountPaid ?? 0),
        remainingAmount: Number(req.remainingAmount ?? 0),
      },
    } as Partial<Booking>);

    const savedBooking = await queryRunner.manager.save(booking);
    const existingTickets = await queryRunner.manager.find(Ticket, {
      where: { bookingId: savedBooking.id },
    });
    if (existingTickets.length === 0) {
      const { validFrom, validUntil } = resolveEventTicketWindow(
        req.startTime,
        req.durationHours,
      );
      const qrToken = `${savedBooking.id}-private-group-${crypto.randomBytes(16).toString('hex')}`;
      const qrTokenHash = crypto
        .createHash('sha256')
        .update(qrToken)
        .digest('hex');
      const groupTicket = queryRunner.manager.create(Ticket, {
        bookingId: savedBooking.id,
        qrTokenHash,
        status: TicketStatus.VALID,
        personCount: req.persons,
        validFrom,
        validUntil,
      } as Partial<Ticket>);
      await queryRunner.manager.save(groupTicket);
    }
    return savedBooking;
  }

  private normalizeMoney(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}
