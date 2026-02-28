import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual, MoreThanOrEqual, IsNull, Between } from 'typeorm';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { User } from '../../database/entities/user.entity';
import { Offer } from '../../database/entities/offer.entity';
import { Branch } from '../../database/entities/branch.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingQuoteDto } from './dto/booking-quote.dto';
import { ScanTicketDto } from './dto/scan-ticket.dto';
import { CreateFreeTicketDto } from './dto/create-free-ticket.dto';
import { CreateFreeTicketAdminDto } from './dto/create-free-ticket-admin.dto';
import { ContentService } from '../content/content.service';
import { CouponsService } from '../coupons/coupons.service';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { getBookingSlotMinutes } from '../../config/booking.config';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly slotMinutes: number;

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Ticket)
    private ticketRepository: Repository<Ticket>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Offer)
    private offerRepository: Repository<Offer>,
    private contentService: ContentService,
    private couponsService: CouponsService,
    private qrCodeService: QRCodeService,
    private redisService: RedisService,
    private dataSource: DataSource,
    private notifications: NotificationsService,
    private configService: ConfigService,
    private realtime?: RealtimeGateway,
  ) {
    this.slotMinutes = getBookingSlotMinutes(this.configService);
  }

  private ensureSlotAlignment(start: Date) {
    const timestamp = start.getTime();
    if (Number.isNaN(timestamp)) {
      throw new BadRequestException('Invalid start time');
    }

    const seconds = start.getUTCSeconds();
    const millis = start.getUTCMilliseconds();
    const minutes = start.getUTCMinutes();

    if (
      seconds !== 0 ||
      millis !== 0 ||
      minutes % this.slotMinutes !== 0
    ) {
      throw new BadRequestException(
        `Start time must align with ${this.slotMinutes}-minute slots (e.g. 17:00, 18:00).`,
      );
    }
  }

  async getQuote(quoteDto: BookingQuoteDto): Promise<{
    branchId: string;
    branchName: string;
    pricing: any;
    addOns: any[];
    discount: number;
    totalPrice: number;
    available: boolean;
  }> {
    try {
      this.logger.log(`Getting quote for branch: ${quoteDto.branchId}`);
      
      const {
        branchId,
        startTime,
        durationHours,
        persons,
        addOns: rawAddOns,
        couponCode,
      } = quoteDto;
      
      // Ensure addOns is always an array (handle null/undefined)
      const addOns = Array.isArray(rawAddOns) ? rawAddOns : [];

      // #region agent log
      const now = new Date();
      const requestedStart = new Date(startTime);
      const nowTime = now.getTime();
      const requestedTime = requestedStart.getTime();
      const timeDiffMs = requestedTime - nowTime;
      const logData = {
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'E',
        location: 'bookings.service.ts:104',
        message: 'Server received startTime and parsed it',
        data: {
          startTimeString: startTime,
          nowISO: now.toISOString(),
          requestedStartISO: requestedStart.toISOString(),
          nowTimeMs: nowTime,
          requestedTimeMs: requestedTime,
          timeDiffMs: timeDiffMs,
          comparison: requestedTime <= nowTime,
        },
        timestamp: Date.now(),
      };
      fetch('http://127.0.0.1:7242/ingest/2e2472bd-ae94-4601-b07f-fbff218202a0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      }).catch(() => {});
      // #endregion

      // Prevent quoting in the past
      if (requestedStart.getTime() <= now.getTime()) {
        // #region agent log
        const logData2 = {
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'F',
          location: 'bookings.service.ts:106',
          message: 'Server validation failed - time in past',
          data: {
            startTimeString: startTime,
            nowISO: now.toISOString(),
            requestedStartISO: requestedStart.toISOString(),
            nowTimeMs: nowTime,
            requestedTimeMs: requestedTime,
            timeDiffMs: timeDiffMs,
          },
          timestamp: Date.now(),
        };
        fetch('http://127.0.0.1:7242/ingest/2e2472bd-ae94-4601-b07f-fbff218202a0', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData2),
        }).catch(() => {});
        // #endregion
        throw new BadRequestException('Cannot book in the past');
      }

      this.ensureSlotAlignment(requestedStart);

      // Find branch
      const branch = await this.contentService.findBranchById(branchId);
      this.logger.log(`Found branch: ${branch.name_en}`);

      if (!branch.priceConfig) {
        throw new BadRequestException('Branch does not have pricing configuration');
      }

      // Check availability
      this.logger.log(`Checking availability for branch: ${branch.id}`);
      const isAvailable = await this.contentService.checkBranchAvailability(
        branch.id,
        new Date(startTime),
        durationHours,
        persons,
      );
      this.logger.log(`Branch availability: ${isAvailable}`);

      if (!isAvailable) {
        throw new ConflictException(
          'Selected branch is not available for the specified time',
        );
      }

      // Calculate pricing
      this.logger.log(`Calculating pricing for branch: ${branch.id}`);
      const pricing = await this.contentService.calculateBranchPrice(
        branch.id,
        new Date(startTime),
        durationHours,
        persons,
      );
      this.logger.log(`Pricing calculated: ${JSON.stringify(pricing)}`);

      // Calculate add-ons cost (lookup real prices from content service)
      const availableAddOns = await this.contentService.getBranchAddOns(branch.id);
      const addOnIdToPrice = new Map(availableAddOns.map((a) => [a.id, a.price]));

      const addOnsCost = addOns.reduce((total, addOn) => {
        const addOnPrice = addOnIdToPrice.get(addOn.id) ?? 0;
        return total + addOnPrice * addOn.quantity;
      }, 0);

      // Apply offer discount (branch scoped)
      const subtotalBeforeDiscounts = pricing.totalPrice + addOnsCost;
      const offerDiscount = await this.calculateOfferDiscount(
        branchId,
        null, // No hallId anymore
        subtotalBeforeDiscounts,
        new Date(startTime),
      );

      // Apply coupon discount
      let discount = 0;
      if (couponCode) {
        this.logger.log(`Applying coupon: ${couponCode}`);
        discount = await this.calculateCouponDiscount(
          couponCode,
          Math.max(0, subtotalBeforeDiscounts - offerDiscount),
          branchId,
          null, // No hallId anymore
        );
        this.logger.log(`Discount applied: ${discount}`);
      }

      const totalPrice = Math.max(0, subtotalBeforeDiscounts - offerDiscount - discount);

      const result = {
        branchId: branch.id,
        branchName: branch.name_en,
        pricing,
        addOns: addOns.map((addOn) => {
          const price = addOnIdToPrice.get(addOn.id) ?? 0;
          return {
            ...addOn,
            price,
            total: price * addOn.quantity,
          };
        }),
        discount: Math.round((offerDiscount + discount) * 100) / 100,
        totalPrice: Math.round(totalPrice * 100) / 100,
        available: isAvailable,
      };

      this.logger.log(`Quote result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in getQuote: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createBooking(
    userId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<Booking> {
    const {
      branchId,
      startTime,
      durationHours,
      persons,
      addOns = [],
      couponCode,
      specialRequests,
      contactPhone,
    } = createBookingDto;

    this.logger.log(`Creating booking for branchId: ${branchId}`);

    // Prevent booking in the past
    const nowForCreate = new Date();
    const startForCreate = new Date(startTime);
    if (startForCreate.getTime() <= nowForCreate.getTime()) {
      throw new BadRequestException('Cannot book in the past');
    }
    this.ensureSlotAlignment(startForCreate);

    // Get quote first to validate and calculate pricing
    const quote = await this.getQuote({
      branchId,
      startTime,
      durationHours,
      persons,
      addOns: addOns?.map((a) => ({ id: a.id, quantity: a.quantity })),
      couponCode,
    });

    if (!quote.available) {
      throw new ConflictException('Selected branch is not available');
    }

    this.logger.log(`Creating booking with branchId: ${quote.branchId}`);

    // Start transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create booking
      const booking = queryRunner.manager.create(Booking, {
        userId,
        branchId,
        startTime: new Date(startTime),
        durationHours,
        persons,
        totalPrice: quote.totalPrice,
        status: BookingStatus.PENDING,
        addOns,
        couponCode,
        discountAmount: quote.discount,
        specialRequests,
        contactPhone,
      });

      this.logger.log(`Booking created with branchId: ${booking.branchId}`);
      const savedBooking = await queryRunner.manager.save(booking);
      this.logger.log(`Booking saved with ID: ${savedBooking.id}, branchId: ${savedBooking.branchId}`);

      await queryRunner.commitTransaction();

      this.logger.log(`Booking created: ${savedBooking.id} for user ${userId}`);

      // Clear cache
      await this.redisService.del(`user:${userId}:bookings`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2e2472bd-ae94-4601-b07f-fbff218202a0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H1',
          location: 'bookings.service.ts:createBooking',
          message: 'Cleared bookings cache after creation',
          data: {
            cacheKeyCleared: `user:${userId}:bookings`,
            userId,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      // Schedule reminders: 24h and 2h before start, and at end time
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
      const now = new Date();
      const ms24h = startDate.getTime() - now.getTime() - 24 * 60 * 60 * 1000;
      const ms2h = startDate.getTime() - now.getTime() - 2 * 60 * 60 * 1000;
      const msEnd = endDate.getTime() - now.getTime();
      const msRating = msEnd + 5 * 60 * 60 * 1000; // 5 hours after end

      if (ms24h > 0) {
        await this.notifications.enqueue({
          type: 'BOOKING_REMINDER',
          to: { userId },
          data: { bookingId: savedBooking.id, startTime },
          channels: ['sms', 'push'],
          delayMs: ms24h,
          jobId: `booking:${savedBooking.id}:reminder:24h`,
        });
      }
      if (ms2h > 0) {
        await this.notifications.enqueue({
          type: 'BOOKING_REMINDER',
          to: { userId },
          data: { bookingId: savedBooking.id, startTime },
          channels: ['sms', 'push'],
          delayMs: ms2h,
          jobId: `booking:${savedBooking.id}:reminder:2h`,
        });
      }
      if (msEnd > 0) {
        await this.notifications.enqueue({
          type: 'BOOKING_END',
          to: { userId },
          data: { bookingId: savedBooking.id },
          channels: ['sms', 'push'],
          delayMs: msEnd,
          jobId: `booking:${savedBooking.id}:end`,
        });
      }

      if (msRating > 0) {
        await this.notifications.enqueue({
          type: 'RATING_REQUEST',
          to: { userId },
          data: { bookingId: savedBooking.id },
          channels: ['sms', 'push'],
          delayMs: msRating,
          jobId: `booking:${savedBooking.id}:rating`,
        });
      }

      return savedBooking;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create booking: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findUserBookings(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    bookings: Booking[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const cacheKey = `user:${userId}:bookings:${page}:${limit}`;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2e2472bd-ae94-4601-b07f-fbff218202a0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'bookings.service.ts:findUserBookings:cache-check',
        message: 'Checking cache before fetching bookings',
        data: { cacheKey, page, limit, userId },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2e2472bd-ae94-4601-b07f-fbff218202a0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H1',
          location: 'bookings.service.ts:findUserBookings:cache-hit',
          message: 'Returning cached bookings',
          data: {
            cacheKey,
            page,
            limit,
            userId,
            total: cached?.total ?? null,
            count: cached?.bookings?.length ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return cached;
    }

    const [bookings, total] = await this.bookingRepository.findAndCount({
      where: { userId },
      relations: ['branch', 'tickets', 'payments'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const statusCounts = bookings.reduce((acc, b) => {
      const s = (b as any)?.status ?? 'unknown';
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2e2472bd-ae94-4601-b07f-fbff218202a0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
          hypothesisId: 'H2',
          location: 'bookings.service.ts:findUserBookings:db',
          message: 'Fetched bookings from DB and caching (time/status sample)',
        data: {
          cacheKey,
          page,
          limit,
          userId,
          total,
          count: bookings.length,
            sampleStatus: bookings[0]?.status ?? null,
            sampleStartUTC: bookings[0]?.startTime ?? null,
            sampleStartLocal: bookings[0]?.startTime ? new Date(bookings[0].startTime).toISOString() : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2e2472bd-ae94-4601-b07f-fbff218202a0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H3',
        location: 'bookings.service.ts:findUserBookings:status-mix',
        message: 'Bookings status distribution after DB fetch',
        data: {
          cacheKey,
          statusCounts,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const result = {
      bookings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };

    // Cache for 2 minutes
    await this.redisService.set(cacheKey, result, 120);

    return result;
  }

  async findBranchBookings(
    branchId: string,
    page: number = 1,
    limit: number = 10,
    from?: string,
    to?: string,
    status?: string,
  ): Promise<{
    bookings: Booking[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: any = { branchId };
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      where.createdAt = Between(fromDate, toDate) as any;
    }
    if (status) {
      where.status = status as any;
    }

    this.logger.log(`Finding bookings for branch ${branchId} with filters: ${JSON.stringify(where)}`);

    const [bookings, total] = await this.bookingRepository.findAndCount({
      where,
      relations: ['user', 'branch', 'tickets', 'payments'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    } as any);

    // Log bookings with missing branch data for debugging and try to fix them
    const bookingsWithoutBranch = bookings.filter(b => !b.branch);
    if (bookingsWithoutBranch.length > 0) {
      this.logger.warn(`Found ${bookingsWithoutBranch.length} bookings without branch data in branch ${branchId}: ${bookingsWithoutBranch.map(b => b.id).join(', ')}`);
      
      // Try to load branch data manually for each booking
      for (const booking of bookingsWithoutBranch) {
        if (booking.branchId) {
          try {
            const branch = await this.contentService.findBranchById(booking.branchId);
            booking.branch = branch;
            this.logger.log(`Successfully loaded branch manually for booking ${booking.id}`);
          } catch (error) {
            this.logger.error(`Failed to load branch ${booking.branchId} for booking ${booking.id}`, error);
          }
        }
      }
    }

    this.logger.log(`Found ${total} bookings for branch ${branchId}`);
    return { bookings, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findAllBookings(
    page: number = 1,
    limit: number = 10,
    filters?: { status?: string; branchId?: string; from?: string; to?: string },
  ): Promise<{
    bookings: Booking[];
    total: number;
    page: number;
    totalPages: number;
    stats: { total: number; confirmed: number; pending: number; cancelled: number; totalRevenue: number };
  }> {
    const where: any = {};
    if (filters?.status) where.status = filters.status as any;
    if (filters?.branchId) where.branchId = filters.branchId;
    if (filters?.from && filters?.to) {
      const fromDate = new Date(filters.from);
      const toDate = new Date(filters.to);
      where.startTime = Between(fromDate, toDate) as any;
    }

    const [bookings, total] = await this.bookingRepository.findAndCount({
      where,
      relations: ['user', 'branch', 'tickets', 'payments'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    } as any);

    // Log bookings with missing branch data for debugging and try to fix them
    const bookingsWithoutBranch = bookings.filter(b => !b.branch);
    if (bookingsWithoutBranch.length > 0) {
      this.logger.warn(`Found ${bookingsWithoutBranch.length} bookings without branch data: ${bookingsWithoutBranch.map(b => b.id).join(', ')}`);
      
      // Try to load branch data manually for each booking
      for (const booking of bookingsWithoutBranch) {
        if (booking.branchId) {
          try {
            const branch = await this.contentService.findBranchById(booking.branchId);
            booking.branch = branch;
            this.logger.log(`Successfully loaded branch manually for booking ${booking.id}`);
          } catch (error) {
            this.logger.error(`Failed to load branch ${booking.branchId} for booking ${booking.id}`, error);
          }
        }
      }
    }

    // Stats
    const [confirmed, pending, cancelled] = await Promise.all([
      this.bookingRepository.count({ where: { ...where, status: 'confirmed' as any } }),
      this.bookingRepository.count({ where: { ...where, status: 'pending' as any } }),
      this.bookingRepository.count({ where: { ...where, status: 'cancelled' as any } }),
    ]);
    const revenueRows = await this.bookingRepository.find({
      where: { ...where, status: 'confirmed' as any },
      select: ['totalPrice'] as any,
    } as any);
    const totalRevenue = revenueRows.map((r: any) => Number(r.totalPrice || 0)).reduce((a: number, b: number) => a + b, 0);

    return {
      bookings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: { total, confirmed, pending, cancelled, totalRevenue },
    };
  }

  async findBookingById(id: string, userIdOrRequesterId?: string, requesterBranchId?: string, isRequesterBranchManager?: boolean): Promise<Booking> {
    const where: any = { id };
    if (userIdOrRequesterId && !isRequesterBranchManager) {
      // End-user scope by userId
      where.userId = userIdOrRequesterId;
    }
    const booking = await this.bookingRepository.findOne({
      where,
      relations: ['user', 'branch', 'tickets', 'payments'],
    });

    this.logger.log(`Found booking ${id}: branchId=${booking?.branchId}, userId=${booking?.userId}, status=${booking?.status}`);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check if booking is deleted (branchId is null/undefined after deletion)
    if (!booking.branchId) {
      this.logger.warn(`Booking ${id} has no branchId - may have been deleted`);
      throw new NotFoundException('Booking not found');
    }

    if (isRequesterBranchManager && requesterBranchId && booking.branchId !== requesterBranchId) {
      // Hide existence outside branch
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async getBookingTickets(
    bookingId: string,
    userIdOrRequesterId?: string,
    requesterBranchId?: string,
    isRequesterBranchManager?: boolean,
  ): Promise<Ticket[]> {
    const booking = await this.findBookingById(bookingId, userIdOrRequesterId, requesterBranchId, isRequesterBranchManager);

    return this.ticketRepository.find({
      where: { bookingId: booking.id },
      order: { createdAt: 'ASC' },
    });
  }

  async scanTicket(
    staffId: string,
    scanTicketDto: ScanTicketDto,
  ): Promise<{
    success: boolean;
    ticket?: Ticket;
    booking?: Booking;
    message: string;
  }> {
    const { qrToken } = scanTicketDto;

    // Resolve ephemeral QR token mapping from Redis if exists, else hash directly
    const mappedHash = await this.redisService.get(`share:qr:${qrToken}`);
    const qrTokenHash = mappedHash || this.qrCodeService.generateQRTokenHash(qrToken);
    const ticket = await this.ticketRepository.findOne({
      where: { qrTokenHash },
      relations: ['booking', 'booking.branch', 'booking.user'],
    });

    if (!ticket) {
      return {
        success: false,
        message: 'Invalid QR code',
      };
    }

    // Enforce branch restriction: staff can only scan tickets for their branch (if staff has branch)
    const staff = await this.userRepository.findOne({ where: { id: staffId } });
    if (staff?.branchId && staff.branchId !== ticket.booking.branchId) {
      return {
        success: false,
        ticket,
        booking: ticket.booking,
        message: 'Not allowed',
      };
    }

    // Check ticket status
    if (ticket.status === TicketStatus.USED) {
      return {
        success: false,
        ticket,
        booking: ticket.booking,
        message: 'Ticket already used',
      };
    }

    if (
      ticket.status === TicketStatus.EXPIRED ||
      ticket.status === TicketStatus.CANCELLED
    ) {
      return {
        success: false,
        ticket,
        booking: ticket.booking,
        message: `Ticket is ${ticket.status}`,
      };
    }

    // Check if ticket is valid for current time
    const now = new Date();
    const bookingStart = new Date(ticket.booking.startTime);
    const bookingEnd = new Date(
      bookingStart.getTime() + ticket.booking.durationHours * 60 * 60 * 1000,
    );

    if (now < bookingStart || now > bookingEnd) {
      return {
        success: false,
        ticket,
        booking: ticket.booking,
        message: 'Ticket is not valid for current time',
      };
    }

    // Mark ticket as used
    ticket.status = TicketStatus.USED;
    ticket.scannedAt = now;
    ticket.staffId = staffId;

    await this.ticketRepository.save(ticket);

    this.logger.log(`Ticket scanned: ${ticket.id} by staff ${staffId}`);

    return {
      success: true,
      ticket,
      booking: ticket.booking,
      message: 'Ticket validated successfully',
    };
  }

  async deleteBookingHard(
    bookingId: string,
    userIdOrRequesterId?: string,
    requesterBranchId?: string,
    isRequesterBranchManager?: boolean,
  ): Promise<{ success: true }> {
    // Try to find booking, but handle case where branchId might be undefined
    let booking: Booking | null = null;
    try {
      booking = await this.findBookingById(
        bookingId,
        userIdOrRequesterId,
        requesterBranchId,
        isRequesterBranchManager,
      );
    } catch (error) {
      // If booking not found via findBookingById (e.g., branchId undefined), try direct query
      const where: any = { id: bookingId };
      if (userIdOrRequesterId && !isRequesterBranchManager) {
        where.userId = userIdOrRequesterId;
      }
      booking = await this.bookingRepository.findOne({
        where,
        relations: ['payments'],
      });
      
      if (!booking) {
        this.logger.warn(`Booking ${bookingId} not found for hard delete`);
        throw new NotFoundException('Booking not found');
      }
      
      // If branchId is undefined, booking may already be partially deleted
      if (!booking.branchId) {
        this.logger.warn(`Booking ${bookingId} has no branchId - may already be deleted`);
        // Still proceed with deletion to clean up any remaining data
      }
    }

    this.logger.log(`Hard deleting booking ${bookingId} with ${booking.payments?.length || 0} payments`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // First, delete all related tickets
      const ticketsResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(Ticket)
        .where('bookingId = :bookingId', { bookingId: booking.id })
        .execute();
      
      this.logger.log(`Deleted ${ticketsResult.affected || 0} tickets`);

      // Then, delete all related payments
      const paymentsResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(Payment)
        .where('bookingId = :bookingId', { bookingId: booking.id })
        .execute();
      
      this.logger.log(`Deleted ${paymentsResult.affected || 0} payments`);

      // Finally, delete the booking itself
      const bookingResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(Booking)
        .where('id = :id', { id: booking.id })
        .execute();

      this.logger.log(`Deleted ${bookingResult.affected || 0} booking`);

      if (bookingResult.affected === 0) {
        throw new NotFoundException(`Failed to delete booking ${bookingId}`);
      }

      await queryRunner.commitTransaction();
      
      this.logger.log(`Successfully committed deletion of booking ${bookingId}`);

      // Verify deletion by trying to find the booking
      const verifyBooking = await this.bookingRepository.findOne({
        where: { id: booking.id },
      });
      
      if (verifyBooking) {
        this.logger.error(`Booking ${bookingId} still exists after deletion attempt!`);
        throw new Error(`Failed to delete booking ${bookingId} - booking still exists in database`);
      }
      
      this.logger.log(`Verified: Booking ${bookingId} successfully deleted from database`);

      // Cancel scheduled notifications and clear caches
      try {
        await this.notifications.cancelScheduledForBooking(booking.id);
      } catch (e) {
        this.logger.warn(`Failed to cancel notifications for booking ${booking.id}: ${e}`);
      }
      
      if (booking.userId) {
        try {
          await this.redisService.del(`user:${booking.userId}:bookings`);
        } catch (e) {
          this.logger.warn(`Failed to clear cache for user ${booking.userId}: ${e}`);
        }
      }

      // Realtime notify deletion (optional: using updated event)
      try {
        this.realtime?.emitBookingUpdated(booking.id, { bookingId: booking.id, status: 'DELETED' as any });
      } catch (e) {
        this.logger.warn(`Failed to emit realtime event for booking ${booking.id}: ${e}`);
      }
      
      this.logger.log(`Successfully hard deleted booking ${bookingId}`);
      return { success: true };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to hard delete booking ${bookingId}: ${e}`);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async getTicketByToken(token: string): Promise<{
    ticket: Ticket;
    booking: Booking;
  }> {
    // Accept ephemeral share tokens (resolve to qrTokenHash if present)
    const redis = this.redisService.getClient();
    const mappedHash = await redis.get(`share:qr:${token}`);
    const qrTokenHash = mappedHash || this.qrCodeService.generateQRTokenHash(token);
    const ticket = await this.ticketRepository.findOne({
      where: { qrTokenHash },
      relations: ['booking', 'booking.branch', 'booking.user'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return {
      ticket,
      booking: ticket.booking,
    };
  }

  async getStaffScans(staffId: string): Promise<{
    scans: Ticket[];
  }> {
    const scans = await this.ticketRepository.find({
      where: { staffId },
      order: { scannedAt: 'DESC' },
      relations: ['booking', 'booking.branch'],
    } as any);
    return { scans };
  }

  async getStaffScanStats(staffId: string): Promise<{
    today: number;
    week: number;
    month: number;
    total: number;
    recentScans: Array<{
      id: string;
      scannedAt: Date;
      bookingId: string;
      branch?: string;
      holderName?: string;
    }>;
  }> {
    const now = new Date();
    
    // Get all scans for this staff
    const allScans = await this.ticketRepository.find({
      where: { staffId },
      order: { scannedAt: 'DESC' },
      relations: ['booking', 'booking.branch'],
    } as any);

    // Filter scans that have been scanned (scannedAt is not null)
    const scannedTickets = allScans.filter(ticket => ticket.scannedAt !== null);

    // Calculate today's date boundaries
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Calculate week start (7 days ago)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    // Calculate month start
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count scans by period
    const todayScans = scannedTickets.filter(ticket => {
      const scanDate = new Date(ticket.scannedAt!);
      return scanDate >= todayStart && scanDate <= todayEnd;
    });

    const weekScans = scannedTickets.filter(ticket => {
      const scanDate = new Date(ticket.scannedAt!);
      return scanDate >= weekStart;
    });

    const monthScans = scannedTickets.filter(ticket => {
      const scanDate = new Date(ticket.scannedAt!);
      return scanDate >= monthStart;
    });

    // Get recent scans (last 10)
    const recentScans = scannedTickets.slice(0, 10).map(ticket => ({
      id: ticket.id,
      scannedAt: ticket.scannedAt!,
      bookingId: ticket.bookingId,
      branch: ticket.booking?.branch?.name_ar || ticket.booking?.branch?.name_en || undefined,
      holderName: ticket.holderName || undefined,
    }));

    return {
      today: todayScans.length,
      week: weekScans.length,
      month: monthScans.length,
      total: scannedTickets.length,
      recentScans,
    };
  }

  async cancelBooking(
    bookingId: string,
    userIdOrRequesterId: string,
    reason?: string,
    requesterBranchId?: string,
    isRequesterBranchManager?: boolean,
  ): Promise<Booking> {
    // Try to find booking, handle case where branchId might be undefined
    let booking: Booking;
    try {
      booking = await this.findBookingById(bookingId, userIdOrRequesterId, requesterBranchId, isRequesterBranchManager);
    } catch (error) {
      // If booking not found via findBookingById (e.g., branchId undefined), try direct query
      const where: any = { id: bookingId };
      if (userIdOrRequesterId && !isRequesterBranchManager) {
        where.userId = userIdOrRequesterId;
      }
      const foundBooking = await this.bookingRepository.findOne({
        where,
        relations: ['payments'],
      });
      
      if (!foundBooking) {
        this.logger.warn(`Booking ${bookingId} not found for cancellation`);
        throw new NotFoundException('Booking not found');
      }
      
      // If branchId is undefined, booking may already be partially deleted
      if (!foundBooking.branchId) {
        this.logger.warn(`Booking ${bookingId} has no branchId - treating as already deleted`);
        throw new NotFoundException('Booking not found');
      }
      
      booking = foundBooking;
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed booking');
    }

    // Check if booking has any completed payment
    // Ensure payments array exists and check for completed status
    const payments = booking.payments || [];
    const hasCompletedPayment = payments.length > 0 && 
      payments.some(
        (payment) => payment.status === PaymentStatus.COMPLETED,
      );

    this.logger.log(`Cancel booking ${bookingId}: payments count=${payments.length}, hasCompleted=${hasCompletedPayment}`);

    // If no completed payment, delete the booking completely (hard delete)
    if (!hasCompletedPayment) {
      this.logger.log(`Deleting unpaid booking: ${bookingId} by user ${userIdOrRequesterId} (no completed payment found)`);
      
      // Save booking info before deletion for response
      const bookingInfo = { ...booking };
      
      // Delete the booking
      await this.deleteBookingHard(bookingId, userIdOrRequesterId, requesterBranchId, isRequesterBranchManager);
      
      // Return deleted booking info with cancelled status for API compatibility
      return {
        ...bookingInfo,
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason || 'Unpaid booking deleted',
      } as Booking;
    }

    const now = new Date();
    // For paid bookings, apply 24h cancellation rule (skip for admins/managers)
    if (!isRequesterBranchManager) {
      const bookingStart = new Date(booking.startTime);
      const isPast = bookingStart.getTime() <= now.getTime();
      if (!isPast) {
        const hoursUntilBooking =
          (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilBooking < 24) {
          throw new BadRequestException(
            'Cannot cancel booking less than 24 hours before start time',
          );
        }
      }
    }

    // Start transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update booking status
      booking.status = BookingStatus.CANCELLED;
      booking.cancelledAt = now;
      if (reason) {
        booking.cancellationReason = reason;
      }

      await queryRunner.manager.save(booking);

      // Cancel all tickets
      await queryRunner.manager.update(
        Ticket,
        { bookingId: booking.id },
        { status: TicketStatus.CANCELLED },
      );

      await queryRunner.commitTransaction();

      this.logger.log(`Booking cancelled: ${bookingId} by user ${userIdOrRequesterId}`);

      // Clear cache
      await this.redisService.del(`user:${userIdOrRequesterId}:bookings`);

      // Cancel any scheduled notifications for this booking
      await this.notifications.cancelScheduledForBooking(booking.id);

      // Notify cancellation
      await this.notifications.enqueue({
        type: 'BOOKING_CANCELLED',
        to: { userId: userIdOrRequesterId },
        data: { bookingId: booking.id, reason },
        channels: ['sms', 'push'],
      });

      // realtime
      this.realtime?.emitBookingUpdated(booking.id, { bookingId: booking.id, status: booking.status });
      return booking;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Removed findAvailableHalls - no longer needed as each branch has one hall merged into it

  private async generateTickets(
    queryRunner: any,
    booking: Booking,
    personCount: number,
  ): Promise<Ticket[]> {
    const tickets: Ticket[] = [];

    for (let i = 0; i < personCount; i++) {
      const qrToken = this.qrCodeService.generateQRToken(
        booking.id,
        `${booking.id}-${i}`,
      );
      const qrTokenHash = this.qrCodeService.generateQRTokenHash(qrToken);

      const ticket = queryRunner.manager.create(Ticket, {
        bookingId: booking.id,
        qrTokenHash,
        status: TicketStatus.VALID,
        personCount: 1,
        validFrom: booking.startTime,
        validUntil: new Date(
          booking.startTime.getTime() + booking.durationHours * 60 * 60 * 1000,
        ),
      });

      const savedTicket = await queryRunner.manager.save(ticket);
      tickets.push(savedTicket);
    }

    return tickets;
  }

  async issueTicketsForBooking(bookingId: string): Promise<Ticket[]> {
    const booking = await this.bookingRepository.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const tickets = await this.generateTickets(queryRunner, booking, booking.persons);
      await queryRunner.commitTransaction();
      return tickets;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  private async calculateCouponDiscount(
    couponCode: string,
    totalAmount: number,
    branchId?: string,
    hallId?: string | null,
  ): Promise<number> {
    try {
      const preview = await this.couponsService.preview(couponCode, totalAmount, {
        branchId,
        hallId: null, // No longer used
      });

      if (!preview.valid) {
        this.logger.warn(
          `Coupon ${couponCode} is invalid for amount ${totalAmount}. Reason: ${preview.reason}`,
        );
        return 0;
      }

      return Number(preview.discountAmount) || 0;
    } catch (error) {
      this.logger.error(
        `Failed to calculate coupon discount for ${couponCode}: ${error?.message || error}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }

  private async calculateOfferDiscount(
    branchId: string,
    hallId: string | null,
    amount: number,
    at: Date,
  ): Promise<number> {
    try {
      // Only look for branch-level offers (no hallId)
      const offers = await this.offerRepository.find({
        where: [
          { branchId, isActive: true, startsAt: IsNull(), endsAt: IsNull() },
          { branchId, isActive: true, startsAt: LessThanOrEqual(at), endsAt: IsNull() },
          { branchId, isActive: true, startsAt: IsNull(), endsAt: MoreThanOrEqual(at) },
          { branchId, isActive: true, startsAt: LessThanOrEqual(at), endsAt: MoreThanOrEqual(at) },
        ] as any,
        order: { createdAt: 'DESC' } as any,
      });
      let best = 0;
      for (const o of offers) {
        const d = o.discountType === 'percentage'
          ? (amount * Number(o.discountValue)) / 100
          : Number(o.discountValue);
        if (d > best) best = d;
      }
      return Math.min(best, amount);
    } catch (e) {
      this.logger.error('Failed to calculate offer discount', e as any);
      return 0;
    }
  }

  async getBookingPricing(bookingId: string): Promise<{
    basePrice: number;
    hourlyPrice: number;
    personsPrice: number;
    pricePerPerson: number;
    multiplier: number;
    decorationPrice: number;
    totalPrice: number;
  }> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['branch'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.branchId) {
      throw new BadRequestException('Booking has no associated branch');
    }

    // Calculate pricing using the same logic as quote calculation
    const pricing = await this.contentService.calculateBranchPrice(
      booking.branchId,
      booking.startTime,
      booking.durationHours,
      booking.persons,
    );

    return pricing;
  }

  async createFreeTicket(
    managerId: string,
    managerBranchId: string,
    dto: CreateFreeTicketDto,
  ): Promise<{ booking: Booking; tickets: Ticket[] }> {
    // Verify target user exists
    const targetUser = await this.userRepository.findOne({
      where: { id: dto.userId },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // For branch managers: ensure target user is in the same branch (if they have a branch)
    // Note: Regular users might not have branchId, so we allow creating tickets for any user
    // but the booking will be created for the manager's branch
    
    const startTime = new Date(dto.startTime);
    if (startTime.getTime() <= new Date().getTime()) {
      throw new BadRequestException('Cannot create ticket for past time');
    }
    this.ensureSlotAlignment(startTime);

    // Use manager's branch ID
    const branchId = managerBranchId;
    
    try {
      const branch = await this.contentService.findBranchById(branchId);
      if (branch.id !== managerBranchId) {
        throw new ForbiddenException('Branch does not belong to your branch');
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new NotFoundException('Branch not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create free booking (totalPrice = 0)
      const booking = queryRunner.manager.create(Booking, {
        userId: dto.userId,
        branchId: managerBranchId,
        startTime: startTime,
        durationHours: dto.durationHours,
        persons: dto.persons,
        totalPrice: 0 as any, // Free ticket
        status: BookingStatus.CONFIRMED, // Directly confirmed for free tickets
        specialRequests: dto.notes || null,
      } as Partial<Booking>);

      const savedBooking = await queryRunner.manager.save(booking);

      // Generate tickets immediately
      const tickets = await this.generateTickets(
        queryRunner,
        savedBooking,
        dto.persons,
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `Free ticket created: booking ${savedBooking.id} with ${tickets.length} tickets by manager ${managerId}`,
      );

      // Clear cache
      await this.redisService.del(`user:${dto.userId}:bookings`);

      // Send notification to user
      await this.notifications.enqueue({
        type: 'TICKETS_ISSUED',
        to: { userId: dto.userId },
        data: { bookingId: savedBooking.id, isFree: true },
        channels: ['sms', 'push'],
      });

      // Realtime update
      this.realtime?.emitBookingUpdated(savedBooking.id, {
        bookingId: savedBooking.id,
        status: savedBooking.status,
      });

      return { booking: savedBooking, tickets };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createFreeTicketForAdmin(
    adminId: string,
    dto: CreateFreeTicketAdminDto,
  ): Promise<{ booking: Booking; tickets: Ticket[] }> {
    // Verify target user exists
    const targetUser = await this.userRepository.findOne({
      where: { id: dto.userId },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Verify branch exists
    const branch = await this.contentService.findBranchById(dto.branchId);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const startTime = new Date(dto.startTime);
    if (startTime.getTime() <= new Date().getTime()) {
      throw new BadRequestException('Cannot create ticket for past time');
    }
    this.ensureSlotAlignment(startTime);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create free booking (totalPrice = 0)
      const booking = queryRunner.manager.create(Booking, {
        userId: dto.userId,
        branchId: dto.branchId,
        startTime: startTime,
        durationHours: dto.durationHours,
        persons: dto.persons,
        totalPrice: 0 as any, // Free ticket
        status: BookingStatus.CONFIRMED, // Directly confirmed for free tickets
        specialRequests: dto.notes || null,
      } as Partial<Booking>);

      const savedBooking = await queryRunner.manager.save(booking);

      // Generate tickets immediately
      const tickets = await this.generateTickets(
        queryRunner,
        savedBooking,
        dto.persons,
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `Free ticket created by admin: booking ${savedBooking.id} with ${tickets.length} tickets by admin ${adminId}`,
      );

      // Clear cache
      await this.redisService.del(`user:${dto.userId}:bookings`);

      // Send notification to user
      await this.notifications.enqueue({
        type: 'TICKETS_ISSUED',
        to: { userId: dto.userId },
        data: { bookingId: savedBooking.id, isFree: true },
        channels: ['sms', 'push'],
      });

      // Realtime update
      this.realtime?.emitBookingUpdated(savedBooking.id, {
        bookingId: savedBooking.id,
        status: savedBooking.status,
      });

      return { booking: savedBooking, tickets };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
