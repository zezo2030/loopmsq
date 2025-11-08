import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual, MoreThanOrEqual, IsNull, Between } from 'typeorm';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { Payment } from '../../database/entities/payment.entity';
import { User } from '../../database/entities/user.entity';
import { Offer } from '../../database/entities/offer.entity';
import { Branch } from '../../database/entities/branch.entity';
import { Hall } from '../../database/entities/hall.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingQuoteDto } from './dto/booking-quote.dto';
import { ScanTicketDto } from './dto/scan-ticket.dto';
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
    hallId: string;
    hallName: string;
    pricing: any;
    addOns: any[];
    discount: number;
    totalPrice: number;
    available: boolean;
  }> {
    try {
      this.logger.log(`Getting quote for branch: ${quoteDto.branchId}, hall: ${quoteDto.hallId || 'auto'}`);
      
      const {
        branchId,
        hallId,
        startTime,
        durationHours,
        persons,
        addOns = [],
        couponCode,
      } = quoteDto;

      // Prevent quoting in the past
      const now = new Date();
      const requestedStart = new Date(startTime);
      if (requestedStart.getTime() <= now.getTime()) {
        throw new BadRequestException('Cannot book in the past');
      }

      this.ensureSlotAlignment(requestedStart);

      // Find available hall if not specified
      let selectedHall: Hall;
      this.logger.log(`Looking for specific hall: ${hallId}`);
      try {
        selectedHall = await this.contentService.findHallById(hallId);
        this.logger.log(`Found hall: ${selectedHall.name_en} with capacity: ${selectedHall.capacity}`);
      } catch (error) {
        this.logger.error(`Failed to find hall with ID: ${hallId}`, error);
        throw new BadRequestException(`Hall with ID ${hallId} not found`);
      }

      // Check availability
      this.logger.log(`Checking availability for hall: ${selectedHall.id}`);
      const isAvailable = await this.contentService.checkHallAvailability(
        selectedHall.id,
        new Date(startTime),
        durationHours,
        persons,
      );
      this.logger.log(`Hall availability: ${isAvailable}`);

      if (!isAvailable) {
        throw new ConflictException(
          'Selected hall is not available for the specified time',
        );
      }

      // Calculate pricing
      this.logger.log(`Calculating pricing for hall: ${selectedHall.id}`);
      const pricing = await this.contentService.calculateHallPrice(
        selectedHall.id,
        new Date(startTime),
        durationHours,
        persons,
      );
      this.logger.log(`Pricing calculated: ${JSON.stringify(pricing)}`);

      // Calculate add-ons cost (lookup real prices from content service)
      const availableAddOns = await this.contentService.getHallAddOns(selectedHall.id);
      const addOnIdToPrice = new Map(availableAddOns.map((a) => [a.id, a.price]));

      const addOnsCost = addOns.reduce((total, addOn) => {
        const addOnPrice = addOnIdToPrice.get(addOn.id) ?? 0;
        return total + addOnPrice * addOn.quantity;
      }, 0);

      // Apply offer discount (branch/hall scoped)
      const subtotalBeforeDiscounts = pricing.totalPrice + addOnsCost;
      const offerDiscount = await this.calculateOfferDiscount(
        branchId,
        selectedHall.id,
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
          selectedHall.id,
        );
        this.logger.log(`Discount applied: ${discount}`);
      }

      const totalPrice = Math.max(0, subtotalBeforeDiscounts - offerDiscount - discount);

      const result = {
        hallId: selectedHall.id,
        hallName: selectedHall.name_en,
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
      hallId,
      startTime,
      durationHours,
      persons,
      addOns = [],
      couponCode,
      specialRequests,
      contactPhone,
    } = createBookingDto;

    // Validate required fields
    if (!hallId) {
      throw new BadRequestException('Hall ID is required');
    }

    this.logger.log(`Creating booking for hallId: ${hallId}, branchId: ${branchId}`);

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
      hallId,
      startTime,
      durationHours,
      persons,
      addOns: addOns?.map((a) => ({ id: a.id, quantity: a.quantity })),
      couponCode,
    });

    if (!quote.available) {
      throw new ConflictException('Selected hall is not available');
    }

    // Validate that hallId is present
    if (!quote.hallId) {
      this.logger.error(`Hall ID is missing from quote for booking: branchId=${branchId}, hallId=${hallId}`);
      throw new BadRequestException('Hall ID is required for booking');
    }

    this.logger.log(`Creating booking with hallId: ${quote.hallId}`);

    // Start transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create booking
      const booking = queryRunner.manager.create(Booking, {
        userId,
        branchId,
        hallId: quote.hallId,
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

      this.logger.log(`Booking created with hallId: ${booking.hallId}`);
      const savedBooking = await queryRunner.manager.save(booking);
      this.logger.log(`Booking saved with ID: ${savedBooking.id}, hallId: ${savedBooking.hallId}`);

      await queryRunner.commitTransaction();

      this.logger.log(`Booking created: ${savedBooking.id} for user ${userId}`);

      // Clear cache
      await this.redisService.del(`user:${userId}:bookings`);

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

    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [bookings, total] = await this.bookingRepository.findAndCount({
      where: { userId },
      relations: ['branch', 'hall', 'tickets', 'payments'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

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
      relations: ['user', 'branch', 'hall', 'tickets', 'payments'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    } as any);

    // Log bookings with missing hall data for debugging and try to fix them
    const bookingsWithoutHall = bookings.filter(b => !b.hall);
    if (bookingsWithoutHall.length > 0) {
      this.logger.warn(`Found ${bookingsWithoutHall.length} bookings without hall data in branch ${branchId}: ${bookingsWithoutHall.map(b => b.id).join(', ')}`);
      
      // Try to load hall data manually for each booking
      for (const booking of bookingsWithoutHall) {
        if (booking.hallId) {
          try {
            const hall = await this.contentService.findHallById(booking.hallId);
            booking.hall = hall;
            this.logger.log(`Successfully loaded hall manually for booking ${booking.id}`);
          } catch (error) {
            this.logger.error(`Failed to load hall ${booking.hallId} for booking ${booking.id}`, error);
          }
        }
      }
    }

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
    filters?: { status?: string; branchId?: string; hallId?: string; from?: string; to?: string },
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
    if (filters?.hallId) where.hallId = filters.hallId;
    if (filters?.from && filters?.to) {
      const fromDate = new Date(filters.from);
      const toDate = new Date(filters.to);
      where.startTime = Between(fromDate, toDate) as any;
    }

    const [bookings, total] = await this.bookingRepository.findAndCount({
      where,
      relations: ['user', 'branch', 'hall', 'tickets', 'payments'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    } as any);

    // Log bookings with missing hall data for debugging and try to fix them
    const bookingsWithoutHall = bookings.filter(b => !b.hall);
    if (bookingsWithoutHall.length > 0) {
      this.logger.warn(`Found ${bookingsWithoutHall.length} bookings without hall data: ${bookingsWithoutHall.map(b => b.id).join(', ')}`);
      
      // Try to load hall data manually for each booking
      for (const booking of bookingsWithoutHall) {
        if (booking.hallId) {
          try {
            const hall = await this.contentService.findHallById(booking.hallId);
            booking.hall = hall;
            this.logger.log(`Successfully loaded hall manually for booking ${booking.id}`);
          } catch (error) {
            this.logger.error(`Failed to load hall ${booking.hallId} for booking ${booking.id}`, error);
          }
        }
      }
    }

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
      relations: ['user', 'branch', 'hall', 'tickets', 'payments'],
    });

    this.logger.log(`Found booking ${id}: hallId=${booking?.hallId}, hasHall=${!!booking?.hall}`);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Log if hall data is missing and try to load it manually
    if (!booking.hall && booking.hallId) {
      this.logger.warn(`Booking ${booking.id} has no hall data despite hallId: ${booking.hallId}`);
      try {
        // Try to load hall manually
        const hall = await this.contentService.findHallById(booking.hallId);
        booking.hall = hall;
        this.logger.log(`Successfully loaded hall manually for booking ${booking.id}`);
      } catch (error) {
        this.logger.error(`Failed to load hall ${booking.hallId} for booking ${booking.id}`, error);
      }
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
      relations: ['booking', 'booking.branch', 'booking.hall', 'booking.user'],
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
    const booking = await this.findBookingById(
      bookingId,
      userIdOrRequesterId,
      requesterBranchId,
      isRequesterBranchManager,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Delete related tickets and payments, then booking
      await queryRunner.manager.delete(Ticket, { bookingId: booking.id });
      await queryRunner.manager.delete(Payment, { bookingId: booking.id });
      await queryRunner.manager.delete(Booking, { id: booking.id });

      await queryRunner.commitTransaction();

      // Cancel scheduled notifications and clear caches
      await this.notifications.cancelScheduledForBooking(booking.id);
      await this.redisService.del(`user:${booking.userId}:bookings`);

      // Realtime notify deletion (optional: using updated event)
      this.realtime?.emitBookingUpdated(booking.id, { bookingId: booking.id, status: 'DELETED' as any });
      return { success: true };
    } catch (e) {
      await queryRunner.rollbackTransaction();
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
      relations: ['booking', 'booking.branch', 'booking.hall', 'booking.user'],
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
      relations: ['booking', 'booking.branch', 'booking.hall'],
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
      hall?: string;
      holderName?: string;
    }>;
  }> {
    const now = new Date();
    
    // Get all scans for this staff
    const allScans = await this.ticketRepository.find({
      where: { staffId },
      order: { scannedAt: 'DESC' },
      relations: ['booking', 'booking.branch', 'booking.hall'],
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
      hall: ticket.booking?.hall?.name_ar || ticket.booking?.hall?.name_en || undefined,
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
    const booking = await this.findBookingById(bookingId, userIdOrRequesterId, requesterBranchId, isRequesterBranchManager);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed booking');
    }

    // Allow cancelling past pending bookings; enforce 24h rule only for future bookings
    const now = new Date();
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

  private async findAvailableHalls(
    branchId: string,
    startTime: Date,
    durationHours: number,
    persons: number,
  ): Promise<Hall[]> {
    const halls = await this.contentService.findAllHalls(branchId);

    const availableHalls: Hall[] = [];
    for (const hall of halls) {
      if (hall.capacity >= persons) {
        const isAvailable = await this.contentService.checkHallAvailability(
          hall.id,
          startTime,
          durationHours,
        );
        if (isAvailable) {
          availableHalls.push(hall);
        }
      }
    }

    return availableHalls.sort((a, b) => a.capacity - b.capacity); // Sort by capacity ascending
  }

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
    hallId?: string,
  ): Promise<number> {
    try {
      const preview = await this.couponsService.preview(couponCode, totalAmount, {
        branchId,
        hallId,
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
    hallId: string,
    amount: number,
    at: Date,
  ): Promise<number> {
    try {
      const offers = await this.offerRepository.find({
        where: [
          { branchId, hallId: IsNull(), isActive: true, startsAt: IsNull(), endsAt: IsNull() },
          { branchId, hallId, isActive: true, startsAt: IsNull(), endsAt: IsNull() },
          { branchId, hallId: IsNull(), isActive: true, startsAt: LessThanOrEqual(at), endsAt: IsNull() },
          { branchId, hallId, isActive: true, startsAt: LessThanOrEqual(at), endsAt: IsNull() },
          { branchId, hallId: IsNull(), isActive: true, startsAt: IsNull(), endsAt: MoreThanOrEqual(at) },
          { branchId, hallId, isActive: true, startsAt: IsNull(), endsAt: MoreThanOrEqual(at) },
          { branchId, hallId: IsNull(), isActive: true, startsAt: LessThanOrEqual(at), endsAt: MoreThanOrEqual(at) },
          { branchId, hallId, isActive: true, startsAt: LessThanOrEqual(at), endsAt: MoreThanOrEqual(at) },
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
      relations: ['hall'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (!booking.hallId) {
      throw new BadRequestException('Booking has no associated hall');
    }

    // Calculate pricing using the same logic as quote calculation
    const pricing = await this.contentService.calculateHallPrice(
      booking.hallId,
      booking.startTime,
      booking.durationHours,
      booking.persons,
    );

    return pricing;
  }
}
