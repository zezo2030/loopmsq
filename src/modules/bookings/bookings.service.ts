import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { User } from '../../database/entities/user.entity';
import { Branch } from '../../database/entities/branch.entity';
import { Hall } from '../../database/entities/hall.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingQuoteDto } from './dto/booking-quote.dto';
import { ScanTicketDto } from './dto/scan-ticket.dto';
import { ContentService } from '../content/content.service';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Ticket)
    private ticketRepository: Repository<Ticket>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private contentService: ContentService,
    private qrCodeService: QRCodeService,
    private redisService: RedisService,
    private dataSource: DataSource,
  ) {}

  async getQuote(quoteDto: BookingQuoteDto): Promise<{
    hallId: string;
    hallName: string;
    pricing: any;
    addOns: any[];
    discount: number;
    totalPrice: number;
    available: boolean;
  }> {
    const { branchId, hallId, startTime, durationHours, persons, addOns = [], couponCode } = quoteDto;

    // Find available hall if not specified
    let selectedHall: Hall;
    if (hallId) {
      selectedHall = await this.contentService.findHallById(hallId);
    } else {
      // Find available hall in the branch
      const availableHalls = await this.findAvailableHalls(branchId, new Date(startTime), durationHours, persons);
      if (availableHalls.length === 0) {
        throw new BadRequestException('No available halls for the specified time and capacity');
      }
      selectedHall = availableHalls[0]; // Select the first available hall
    }

    // Check availability
    const isAvailable = await this.contentService.checkHallAvailability(
      selectedHall.id,
      new Date(startTime),
      durationHours,
    );

    if (!isAvailable) {
      throw new ConflictException('Selected hall is not available for the specified time');
    }

    // Calculate pricing
    const pricing = await this.contentService.calculateHallPrice(
      selectedHall.id,
      new Date(startTime),
      durationHours,
      persons,
    );

    // Calculate add-ons cost
    const addOnsCost = addOns.reduce((total, addOn) => {
      // In a real implementation, you would fetch add-on prices from database
      const addOnPrice = 50; // Mock price
      return total + (addOnPrice * addOn.quantity);
    }, 0);

    // Apply coupon discount
    let discount = 0;
    if (couponCode) {
      discount = await this.calculateCouponDiscount(couponCode, pricing.totalPrice + addOnsCost);
    }

    const totalPrice = pricing.totalPrice + addOnsCost - discount;

    return {
      hallId: selectedHall.id,
      hallName: selectedHall.name_en,
      pricing,
      addOns: addOns.map(addOn => ({
        ...addOn,
        price: 50, // Mock price
        total: 50 * addOn.quantity,
      })),
      discount,
      totalPrice: Math.round(totalPrice * 100) / 100,
      available: isAvailable,
    };
  }

  async createBooking(userId: string, createBookingDto: CreateBookingDto): Promise<Booking> {
    const { branchId, hallId, startTime, durationHours, persons, addOns = [], couponCode, specialRequests, contactPhone } = createBookingDto;

    // Get quote first to validate and calculate pricing
    const quote = await this.getQuote({
      branchId,
      hallId,
      startTime,
      durationHours,
      persons,
      addOns: addOns?.map(a => ({ id: a.id, quantity: a.quantity })),
      couponCode,
    });

    if (!quote.available) {
      throw new ConflictException('Selected hall is not available');
    }

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

      const savedBooking = await queryRunner.manager.save(booking);

      // Generate tickets
      const tickets = await this.generateTickets(queryRunner, savedBooking, persons);

      await queryRunner.commitTransaction();

      this.logger.log(`Booking created: ${savedBooking.id} for user ${userId}`);

      // Clear cache
      await this.redisService.del(`user:${userId}:bookings`);

      return savedBooking;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create booking: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findUserBookings(userId: string, page: number = 1, limit: number = 10): Promise<{
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

  async findBookingById(id: string, userId?: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id, ...(userId && { userId }) },
      relations: ['user', 'branch', 'hall', 'tickets', 'payments'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async getBookingTickets(bookingId: string, userId?: string): Promise<Ticket[]> {
    const booking = await this.findBookingById(bookingId, userId);
    
    return this.ticketRepository.find({
      where: { bookingId: booking.id },
      order: { createdAt: 'ASC' },
    });
  }

  async scanTicket(staffId: string, scanTicketDto: ScanTicketDto): Promise<{
    success: boolean;
    ticket?: Ticket;
    booking?: Booking;
    message: string;
  }> {
    const { qrToken } = scanTicketDto;

    // Find ticket by QR token hash
    const qrTokenHash = this.qrCodeService.generateQRTokenHash(qrToken);
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

    // Check ticket status
    if (ticket.status === TicketStatus.USED) {
      return {
        success: false,
        ticket,
        booking: ticket.booking,
        message: 'Ticket already used',
      };
    }

    if (ticket.status === TicketStatus.EXPIRED || ticket.status === TicketStatus.CANCELLED) {
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
    const bookingEnd = new Date(bookingStart.getTime() + ticket.booking.durationHours * 60 * 60 * 1000);

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

  async getTicketByToken(token: string): Promise<{
    ticket: Ticket;
    booking: Booking;
  }> {
    const qrTokenHash = this.qrCodeService.generateQRTokenHash(token);
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

  async cancelBooking(bookingId: string, userId: string, reason?: string): Promise<Booking> {
    const booking = await this.findBookingById(bookingId, userId);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed booking');
    }

    // Check if booking can be cancelled (e.g., not too close to start time)
    const now = new Date();
    const bookingStart = new Date(booking.startTime);
    const hoursUntilBooking = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < 24) {
      throw new BadRequestException('Cannot cancel booking less than 24 hours before start time');
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

      this.logger.log(`Booking cancelled: ${bookingId} by user ${userId}`);

      // Clear cache
      await this.redisService.del(`user:${userId}:bookings`);

      return booking;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async findAvailableHalls(branchId: string, startTime: Date, durationHours: number, persons: number): Promise<Hall[]> {
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

  private async generateTickets(queryRunner: any, booking: Booking, personCount: number): Promise<Ticket[]> {
    const tickets: Ticket[] = [];
    
    for (let i = 0; i < personCount; i++) {
      const qrToken = this.qrCodeService.generateQRToken(booking.id, `${booking.id}-${i}`);
      const qrTokenHash = this.qrCodeService.generateQRTokenHash(qrToken);

      const ticket = queryRunner.manager.create(Ticket, {
        bookingId: booking.id,
        qrTokenHash,
        status: TicketStatus.VALID,
        personCount: 1,
        validFrom: booking.startTime,
        validUntil: new Date(booking.startTime.getTime() + booking.durationHours * 60 * 60 * 1000),
      });

      const savedTicket = await queryRunner.manager.save(ticket);
      tickets.push(savedTicket);
    }

    return tickets;
  }

  private async calculateCouponDiscount(couponCode: string, totalAmount: number): Promise<number> {
    // Mock implementation - in real app, fetch from database
    const coupons = {
      'SAVE20': { type: 'percentage', value: 20, minAmount: 100 },
      'FLAT50': { type: 'fixed', value: 50, minAmount: 200 },
    };

    const coupon = coupons[couponCode];
    if (!coupon || totalAmount < coupon.minAmount) {
      return 0;
    }

    if (coupon.type === 'percentage') {
      return (totalAmount * coupon.value) / 100;
    } else {
      return coupon.value;
    }
  }
}
