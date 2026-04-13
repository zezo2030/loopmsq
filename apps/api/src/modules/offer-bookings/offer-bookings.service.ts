import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import {
  OfferBooking,
  OfferBookingPaymentStatus,
  OfferBookingStatus,
} from '../../database/entities/offer-booking.entity';
import {
  OfferTicket,
  OfferTicketKind,
  OfferTicketStatus,
} from '../../database/entities/offer-ticket.entity';
import {
  OfferProduct,
  OfferCategory,
} from '../../database/entities/offer-product.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { QRCodeService } from '../../utils/qr-code.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../../database/entities/user.entity';
import { instanceToPlain } from 'class-transformer';
import { OfferQuoteDto } from './dto/offer-quote.dto';
import { CreateOfferBookingDto } from './dto/create-offer-booking.dto';

type OfferBookingListFilters = {
  status?: OfferBookingStatus;
  paymentStatus?: OfferBookingPaymentStatus;
  branchId?: string;
  from?: string;
  to?: string;
  search?: string;
};

@Injectable()
export class OfferBookingsService {
  private readonly logger = new Logger(OfferBookingsService.name);

  constructor(
    @InjectRepository(OfferBooking)
    private readonly bookingRepo: Repository<OfferBooking>,
    @InjectRepository(OfferTicket)
    private readonly ticketRepo: Repository<OfferTicket>,
    @InjectRepository(OfferProduct)
    private readonly offerProductRepo: Repository<OfferProduct>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly qrCodeService: QRCodeService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Calculate pricing for an offer purchase before payment.
   */
  async getQuote(userId: string, dto: OfferQuoteDto) {
    const offer = await this.findActiveOffer(dto.offerProductId);

    if (!offer.canRepeatInSameOrder) {
      const existingBooking = await this.bookingRepo.findOne({
        where: {
          userId,
          offerProductId: offer.id,
          status: OfferBookingStatus.ACTIVE,
        },
        order: { createdAt: 'DESC' },
      });
      if (existingBooking) {
        throw new ConflictException(
          'Cannot repeat this offer — an active booking already exists',
        );
      }
    }

    const subtotal = Number(offer.price);
    const resolvedAddOns = this.resolveSelectedAddOns(offer, dto.addOns);
    const addonsTotal = resolvedAddOns.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const totalPrice = subtotal + addonsTotal;

    return {
      offerProductId: offer.id,
      offerTitle: offer.title,
      ticketMode: 'single_ticket',
      offerType: this.buildOfferTypeSummary(offer),
      subtotal,
      addOns: resolvedAddOns,
      addonsTotal,
      totalPrice,
      currency: offer.currency || 'SAR',
    };
  }

  /**
   * Create an offer booking and initiate payment.
   */
  async createBooking(userId: string, dto: CreateOfferBookingDto) {
    const offer = await this.findActiveOffer(dto.offerProductId);

    if (!dto.acceptedTerms) {
      throw new BadRequestException(
        'Offer terms and conditions must be accepted',
      );
    }

    // Check canRepeatInSameOrder
    if (!offer.canRepeatInSameOrder) {
      const existingBooking = await this.bookingRepo.findOne({
        where: {
          userId,
          offerProductId: offer.id,
          status: OfferBookingStatus.ACTIVE,
        },
      });
      if (existingBooking) {
        throw new ConflictException(
          'Cannot repeat this offer — an active booking already exists',
        );
      }
    }

    const subtotal = Number(offer.price);
    const selectedAddOns = this.resolveSelectedAddOns(offer, dto.addOns);
    const addonsTotal = selectedAddOns.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const totalPrice = subtotal + addonsTotal;

    // Create offer snapshot
    const offerSnapshot = this.buildOfferSnapshot(offer);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create booking
      const booking = queryRunner.manager.create(OfferBooking, {
        userId,
        branchId: offer.branchId,
        offerProductId: offer.id,
        offerSnapshot,
        selectedAddOns: selectedAddOns.length > 0 ? selectedAddOns : null,
        subtotal,
        addonsTotal,
        totalPrice,
        paymentStatus: OfferBookingPaymentStatus.PENDING,
        status: OfferBookingStatus.ACTIVE,
        contactPhone: dto.contactPhone || undefined,
      });

      const savedBooking = await queryRunner.manager.save(booking);

      // Create payment record
      const payment = queryRunner.manager.create(Payment, {
        offerBookingId: savedBooking.id,
        amount: totalPrice,
        currency: offer.currency || 'SAR',
        status: PaymentStatus.PENDING,
        method: 'credit_card' as any,
      });

      const savedPayment = await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Offer booking created: ${savedBooking.id} for user ${userId}, payment: ${savedPayment.id}`,
      );

      return {
        id: savedBooking.id,
        paymentId: savedPayment.id,
        paymentUrl: `/pay/${savedPayment.id}`, // Client-side payment URL
        totalPrice,
        currency: offer.currency || 'SAR',
        paymentRequired: true,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to create offer booking: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Called by PaymentsService after payment is confirmed.
   * Generates tickets using QR service in a transaction.
   * Idempotent: safe to call multiple times - skips if tickets already exist.
   */
  async confirmPayment(offerBookingId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id: offerBookingId },
    });

    if (!booking) {
      throw new NotFoundException('Offer booking not found');
    }

    if (booking.paymentStatus === OfferBookingPaymentStatus.COMPLETED) {
      this.logger.warn(`Booking ${offerBookingId} already confirmed`);
      return;
    }

    const offer = await this.offerProductRepo.findOne({
      where: { id: booking.offerProductId },
    });

    if (!offer) {
      throw new NotFoundException('Offer product not found');
    }

    const existingTickets = await this.ticketRepo.find({
      where: { offerBookingId },
    });

    if (existingTickets.length > 0) {
      this.logger.log(
        `Booking ${offerBookingId} already has ${existingTickets.length} tickets - ensuring consistency`,
      );
      booking.paymentStatus = OfferBookingPaymentStatus.COMPLETED;
      await this.bookingRepo.save(booking);
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      booking.paymentStatus = OfferBookingPaymentStatus.COMPLETED;
      await queryRunner.manager.save(OfferBooking, booking);

      const tickets: OfferTicket[] = [];

      const ticket = await this.createOfferTicket(
        queryRunner,
        booking,
        offer,
        offer.offerCategory === OfferCategory.HOUR_BASED
          ? OfferTicketKind.TIMED
          : OfferTicketKind.STANDARD,
      );
      tickets.push(ticket);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Offer booking ${offerBookingId} confirmed with ${tickets.length} ticket generated`,
      );

      await this.notificationsService.enqueue({
        type: 'OFFER_PURCHASE_SUCCESS',
        to: { userId: booking.userId },
        data: {
          bookingId: offerBookingId,
          offerTitle: offer.title,
          ticketCount: 1,
        },
        channels: ['push'],
        lang: 'ar',
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to confirm offer booking: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get paginated user offer bookings.
   */
  async findUserBookings(userId: string, page: number = 1, limit: number = 10) {
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.offerProduct', 'offerProduct')
      .leftJoinAndSelect('booking.tickets', 'ticket')
      .where('booking.userId = :userId', { userId })
      .andWhere(
        `(
          NOT EXISTS (
            SELECT 1 FROM offer_tickets t2
            WHERE t2."offerBookingId" = booking.id
              AND (t2.status = 'used' OR t2.status = 'expired')
              AND t2."scannedAt" IS NOT NULL
              AND t2."scannedAt" < NOW() - INTERVAL '24 HOURS'
          )
        )`
      )
      .orderBy('booking.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [bookings, total] = await qb.getManyAndCount();

    for (const b of bookings) {
      if (b.tickets?.length) {
        await this.expireTimedTicketsPastDeadline(b.tickets);
      }
    }

    const mappedBookings = bookings.map((booking) => {
      const isUsed = booking.tickets?.some(
        (t) =>
          t.status === OfferTicketStatus.USED ||
          t.status === OfferTicketStatus.EXPIRED,
      );

      // Plain object so JSON serialization always includes the derived status (spread
      // of TypeORM entities can keep the original column value in some pipelines).
      const plain = instanceToPlain(booking) as Record<string, unknown>;
      return {
        ...plain,
        status: isUsed ? 'used' : plain.status,
      };
    });

    return {
      bookings: mappedBookings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAdminBookings(
    page: number = 1,
    limit: number = 20,
    filters: OfferBookingListFilters = {},
  ) {
    return this.findBookingsList(page, limit, filters);
  }

  async findBranchBookings(
    branchId: string,
    page: number = 1,
    limit: number = 20,
    filters: Omit<OfferBookingListFilters, 'branchId'> = {},
  ) {
    return this.findBookingsList(page, limit, { ...filters, branchId });
  }

  /**
   * Get offer booking details (owner only).
   */
  async findBookingById(bookingId: string, userId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, userId },
    });

    if (!booking) {
      throw new NotFoundException('Offer booking not found');
    }

    return booking;
  }

  async findBookingForAdmin(bookingId: string) {
    return this.findBookingDetail(bookingId);
  }

  async findBookingForBranch(bookingId: string, branchId: string) {
    return this.findBookingDetail(bookingId, branchId);
  }

  /**
   * Get all tickets for a booking (owner only).
   */
  async findBookingTickets(bookingId: string, userId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId, userId },
    });

    if (!booking) {
      throw new NotFoundException('Offer booking not found');
    }

    const tickets = await this.ticketRepo.find({
      where: { offerBookingId: bookingId },
      order: { createdAt: 'ASC' },
    });

    await this.expireTimedTicketsPastDeadline(tickets);

    return { tickets };
  }

  /**
   * Timed tickets remain `in_use` in the DB until a read path runs this check.
   * Marks them `expired` when now is past `expiresAt` (user app, staff scan, lists).
   */
  private async expireTimedTicketsPastDeadline(
    tickets: OfferTicket[],
  ): Promise<void> {
    if (!tickets?.length) return;
    const now = new Date();
    const updated: OfferTicket[] = [];
    for (const t of tickets) {
      if (
        t.ticketKind === OfferTicketKind.TIMED &&
        t.status === OfferTicketStatus.IN_USE &&
        t.expiresAt &&
        now > new Date(t.expiresAt)
      ) {
        t.status = OfferTicketStatus.EXPIRED;
        updated.push(t);
      }
    }
    if (updated.length) {
      await this.ticketRepo.save(updated);
    }
  }

  /**
   * Find offer ticket by QR token hash (for staff scan preview).
   * Stored hashes use the full raw QR payload `OT:{ticketId}:{suffix}`.
   * Staff preview may pass `{ticketId}:{suffix}` (no prefix); normalize before hashing.
   */
  async findTicketByToken(token: string) {
    const trimmed = token.trim();
    const normalized = trimmed.startsWith('OT:')
      ? trimmed
      : `OT:${trimmed}`;
    const qrTokenHash = this.qrCodeService.hashToken(normalized);

    const ticket = await this.ticketRepo.findOne({
      where: { qrTokenHash },
      relations: [
        'offerBooking',
        'offerBooking.offerProduct',
        'user',
        'branch',
      ],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    await this.expireTimedTicketsPastDeadline([ticket]);

    return ticket;
  }

  /**
   * Staff may only preview/scan offer tickets for their assigned branch.
   */
  private async assertStaffOfferTicketBranch(
    staffId: string,
    ticket: OfferTicket,
  ): Promise<void> {
    const staff = await this.userRepo.findOne({ where: { id: staffId } });
    if (!staff?.branchId || staff.branchId !== ticket.branchId) {
      const b = ticket.branch;
      const ticketBranchName = b?.name_ar || b?.name_en || '';
      throw new HttpException(
        {
          errorCode: 'BRANCH_MISMATCH',
          ticketBranchName,
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /** Resolve ticket by QR token and ensure the staff user belongs to the ticket's branch. */
  async findTicketByTokenForStaff(token: string, staffId: string) {
    const ticket = await this.findTicketByToken(token);
    await this.assertStaffOfferTicketBranch(staffId, ticket);
    return ticket;
  }

  /**
   * Find active offer product with validation.
   */
  private async findActiveOffer(offerProductId: string): Promise<OfferProduct> {
    const offer = await this.offerProductRepo.findOne({
      where: { id: offerProductId },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (!offer.isActive) {
      throw new BadRequestException('Offer is not active');
    }

    const now = new Date();
    if (offer.startsAt && now < offer.startsAt) {
      throw new BadRequestException('Offer has not started yet');
    }
    if (offer.endsAt && now > offer.endsAt) {
      throw new BadRequestException('Offer has expired');
    }

    return offer;
  }

  /**
   * Staff: Scan offer ticket - validate and mark as used or start timer.
   */
  async scanTicket(token: string, staffId: string) {
    const ticket = await this.findTicketByTokenForStaff(token, staffId);

    if (ticket.status === OfferTicketStatus.USED) {
      throw new BadRequestException('Ticket already used');
    }
    if (ticket.status === OfferTicketStatus.EXPIRED) {
      throw new BadRequestException('Ticket expired');
    }
    if (ticket.status === OfferTicketStatus.CANCELLED) {
      throw new BadRequestException('Ticket cancelled');
    }

    const now = new Date();

    if (ticket.ticketKind === OfferTicketKind.STANDARD) {
      ticket.status = OfferTicketStatus.USED;
      ticket.scannedAt = now;
      ticket.staffId = staffId;
      await this.ticketRepo.save(ticket);
      return {
        success: true,
        message: 'Ticket validated successfully',
        ticket,
      };
    }

    if (ticket.ticketKind === OfferTicketKind.TIMED) {
      const offer = await this.offerProductRepo.findOne({
        where: { id: ticket.offerProductId },
      });
      const durationHours = offer?.hoursConfig?.durationHours || 3;

      ticket.status = OfferTicketStatus.IN_USE;
      ticket.scannedAt = now;
      ticket.startedAt = now;
      ticket.expiresAt = new Date(
        now.getTime() + durationHours * 60 * 60 * 1000,
      );
      ticket.staffId = staffId;
      await this.ticketRepo.save(ticket);

      return {
        success: true,
        message: 'Timer started',
        ticket: {
          ...ticket,
          durationHours,
        },
      };
    }

    throw new BadRequestException('Invalid ticket kind');
  }

  /**
   * Find offer by ID.
   */
  async findOfferById(offerProductId: string): Promise<OfferProduct> {
    const offer = await this.offerProductRepo.findOne({
      where: { id: offerProductId },
    });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  private async findBookingsList(
    page: number,
    limit: number,
    filters: OfferBookingListFilters,
  ) {
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .leftJoinAndSelect('booking.branch', 'branch')
      .leftJoinAndSelect('booking.offerProduct', 'offerProduct')
      .loadRelationCountAndMap('booking.ticketsCount', 'booking.tickets');

    if (filters.branchId) {
      qb.andWhere('booking.branchId = :branchId', {
        branchId: filters.branchId,
      });
    }

    if (filters.status) {
      qb.andWhere('booking.status = :status', { status: filters.status });
    }

    if (filters.paymentStatus) {
      qb.andWhere('booking.paymentStatus = :paymentStatus', {
        paymentStatus: filters.paymentStatus,
      });
    }

    if (filters.from) {
      qb.andWhere('booking.createdAt >= :from', { from: filters.from });
    }

    if (filters.to) {
      qb.andWhere('booking.createdAt <= :to', { to: filters.to });
    }

    if (filters.search?.trim()) {
      const search = `%${filters.search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(
          LOWER(COALESCE(user.name, '')) LIKE :search OR
          LOWER(COALESCE(user.phone, '')) LIKE :search OR
          LOWER(COALESCE(branch.name_ar, branch.name_en, '')) LIKE :search OR
          LOWER(COALESCE(offerProduct.title, booking.offerSnapshot->>'title', '')) LIKE :search OR
          LOWER(COALESCE(booking.id::text, '')) LIKE :search
        )`,
        { search },
      );
    }

    qb.orderBy('booking.createdAt', 'DESC');

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsQb = this.bookingRepo
      .createQueryBuilder('booking')
      .select('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN booking.status = :activeStatus THEN 1 ELSE 0 END)`,
        'active',
      )
      .addSelect(
        `SUM(CASE WHEN booking.status = :completedStatus THEN 1 ELSE 0 END)`,
        'completed',
      )
      .addSelect(
        `SUM(CASE WHEN booking.status = :cancelledStatus THEN 1 ELSE 0 END)`,
        'cancelled',
      )
      .addSelect(
        `SUM(CASE WHEN booking.paymentStatus = :completedPaymentStatus THEN 1 ELSE 0 END)`,
        'paid',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN booking.paymentStatus = :completedPaymentStatus THEN booking.totalPrice ELSE 0 END), 0)`,
        'revenue',
      )
      .setParameters({
        activeStatus: OfferBookingStatus.ACTIVE,
        completedStatus: OfferBookingStatus.COMPLETED,
        cancelledStatus: OfferBookingStatus.CANCELLED,
        completedPaymentStatus: OfferBookingPaymentStatus.COMPLETED,
      });

    if (filters.branchId) {
      statsQb.andWhere('booking.branchId = :branchId', {
        branchId: filters.branchId,
      });
    }
    if (filters.status) {
      statsQb.andWhere('booking.status = :status', { status: filters.status });
    }
    if (filters.paymentStatus) {
      statsQb.andWhere('booking.paymentStatus = :paymentStatus', {
        paymentStatus: filters.paymentStatus,
      });
    }
    if (filters.from) {
      statsQb.andWhere('booking.createdAt >= :from', { from: filters.from });
    }
    if (filters.to) {
      statsQb.andWhere('booking.createdAt <= :to', { to: filters.to });
    }

    const rawStats = await statsQb.getRawOne<{
      total: string;
      active: string;
      completed: string;
      cancelled: string;
      paid: string;
      revenue: string;
    }>();

    return {
      bookings: items.map((booking: any) => ({
        id: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        subtotal: Number(booking.subtotal || 0),
        addonsTotal: Number(booking.addonsTotal || 0),
        totalPrice: Number(booking.totalPrice || 0),
        selectedAddOns: booking.selectedAddOns || [],
        contactPhone: booking.contactPhone || '',
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        ticketsCount: Number(booking.ticketsCount || 0),
        user: {
          id: booking.userId,
          name: booking.user?.name || 'User',
          phone: booking.user?.phone || '',
          email: booking.user?.email || '',
        },
        branch: {
          id: booking.branchId,
          name: booking.branch?.name_ar || booking.branch?.name_en || 'Branch',
        },
        offer: {
          id: booking.offerProductId,
          title:
            booking.offerProduct?.title ||
            booking.offerSnapshot?.title ||
            'Offer',
          category:
            booking.offerProduct?.offerCategory ||
            booking.offerSnapshot?.offerCategory ||
            OfferCategory.TICKET_BASED,
          price:
            booking.offerProduct?.price != null
              ? Number(booking.offerProduct.price)
              : Number(booking.offerSnapshot?.price || 0),
          currency:
            booking.offerProduct?.currency ||
            booking.offerSnapshot?.currency ||
            'SAR',
          imageUrl:
            booking.offerProduct?.imageUrl ||
            booking.offerSnapshot?.imageUrl ||
            null,
        },
      })),
      stats: {
        total: Number(rawStats?.total || 0),
        active: Number(rawStats?.active || 0),
        completed: Number(rawStats?.completed || 0),
        cancelled: Number(rawStats?.cancelled || 0),
        paid: Number(rawStats?.paid || 0),
        revenue: Number(rawStats?.revenue || 0),
      },
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private buildOfferTypeSummary(offer: OfferProduct): string {
    if (offer.offerCategory === OfferCategory.HOUR_BASED) {
      const duration = Number(offer.hoursConfig?.durationHours || 0);
      const bonus = Number(offer.hoursConfig?.bonusHours || 0);
      const isOpenTime = offer.hoursConfig?.isOpenTime === true;
      if (isOpenTime) {
        return 'open_time';
      }
      if (duration > 0 && bonus > 0) {
        return `${duration}_plus_${bonus}_hours`;
      }
      if (duration > 0) {
        return `${duration}_hours`;
      }
    }

    const paid = Number(offer.ticketConfig?.paidTicketCount || 1);
    const free = Number(offer.ticketConfig?.freeTicketCount || 0);
    if (free > 0) {
      return `${paid}_plus_${free}_tickets`;
    }
    return 'single_entry';
  }

  private buildOfferSnapshot(offer: OfferProduct) {
    return {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      imageUrl: offer.imageUrl,
      termsAndConditions: offer.termsAndConditions,
      offerCategory: offer.offerCategory,
      offerType: this.buildOfferTypeSummary(offer),
      ticketMode: 'single_ticket',
      price: Number(offer.price),
      currency: offer.currency,
      ticketConfig: offer.ticketConfig,
      hoursConfig: offer.hoursConfig,
      includedAddOns: offer.includedAddOns,
      ticketCount: 1,
      paidTicketsCount: 1,
      freeTicketsCount: 0,
      durationHours: offer.hoursConfig?.durationHours ?? null,
      bonusHours: offer.hoursConfig?.bonusHours ?? 0,
      isOpenTime: offer.hoursConfig?.isOpenTime ?? false,
      includedItems: (offer.includedAddOns || []).map((item) => item.name),
    };
  }

  private resolveSelectedAddOns(
    offer: OfferProduct,
    selected?: { id: string; quantity: number }[],
  ) {
    const catalog = new Map(
      (offer.includedAddOns || []).map((item) => [
        item.addonId,
        {
          id: item.addonId,
          name: item.name,
          price: Number(item.price || 0),
        },
      ]),
    );

    if (!selected?.length) {
      return [];
    }

    return selected.map((addOn) => {
      const matched = catalog.get(addOn.id);
      if (!matched) {
        throw new BadRequestException(
          `Selected add-on is not available: ${addOn.id}`,
        );
      }

      return {
        id: matched.id,
        name: matched.name,
        price: matched.price,
        quantity: addOn.quantity,
      };
    });
  }

  private async findBookingDetail(bookingId: string, branchId?: string) {
    const whereClause: Record<string, any> = { id: bookingId };
    if (branchId) whereClause.branchId = branchId;

    const booking = await this.bookingRepo.findOne({
      where: whereClause,
      relations: ['user', 'branch', 'offerProduct', 'tickets'],
    });

    if (!booking) {
      throw new NotFoundException('Offer booking not found');
    }

    await this.expireTimedTicketsPastDeadline(booking.tickets || []);

    const tickets = (booking.tickets || []).map((ticket) => ({
      id: ticket.id,
      ticketKind: ticket.ticketKind,
      status: ticket.status,
      scannedAt: ticket.scannedAt,
      startedAt: ticket.startedAt,
      expiresAt: ticket.expiresAt,
      createdAt: ticket.createdAt,
    }));

    return {
      id: booking.id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      subtotal: Number(booking.subtotal || 0),
      addonsTotal: Number(booking.addonsTotal || 0),
      totalPrice: Number(booking.totalPrice || 0),
      selectedAddOns: booking.selectedAddOns || [],
      contactPhone: booking.contactPhone || '',
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      ticketsCount: tickets.length,
      tickets,
      user: {
        id: booking.userId,
        name: booking.user?.name || 'User',
        phone: booking.user?.phone || '',
        email: booking.user?.email || '',
      },
      branch: {
        id: booking.branchId,
        name: booking.branch?.name_ar || booking.branch?.name_en || 'Branch',
      },
      offer: {
        id: booking.offerProductId,
        title:
          booking.offerProduct?.title ||
          booking.offerSnapshot?.title ||
          'Offer',
        category:
          booking.offerProduct?.offerCategory ||
          booking.offerSnapshot?.offerCategory ||
          OfferCategory.TICKET_BASED,
        price:
          booking.offerProduct?.price != null
            ? Number(booking.offerProduct.price)
            : Number(booking.offerSnapshot?.price || 0),
        currency:
          booking.offerProduct?.currency ||
          booking.offerSnapshot?.currency ||
          'SAR',
        imageUrl:
          booking.offerProduct?.imageUrl ||
          booking.offerSnapshot?.imageUrl ||
          null,
        description:
          booking.offerProduct?.description ||
          booking.offerSnapshot?.description ||
          null,
      },
    };
  }

  /**
   * Create a single offer ticket with QR token.
   */
  private async createOfferTicket(
    queryRunner: any,
    booking: OfferBooking,
    offer: OfferProduct,
    ticketKind: OfferTicketKind,
  ): Promise<OfferTicket> {
    const provisionalQrToken = this.qrCodeService.generateOfferTicketToken(
      `pending-${booking.id}-${Date.now()}`,
    );

    const ticket = queryRunner.manager.create(OfferTicket, {
      offerBookingId: booking.id,
      userId: booking.userId,
      branchId: booking.branchId,
      offerProductId: offer.id,
      ticketKind,
      qrTokenHash: this.qrCodeService.hashToken(provisionalQrToken),
      status: OfferTicketStatus.VALID,
      metadata: {
        offerTitle: offer.title,
        offerCategory: offer.offerCategory,
        offerType: this.buildOfferTypeSummary(offer),
        termsAndConditions: offer.termsAndConditions || null,
        includedAddOns: offer.includedAddOns || [],
        hoursConfig: offer.hoursConfig || null,
      },
    });

    const savedTicket = await queryRunner.manager.save(OfferTicket, ticket);

    // Generate QR token with the ticket ID
    const rawToken = this.qrCodeService.generateOfferTicketToken(
      savedTicket.id,
    );
    const qrTokenHash = this.qrCodeService.hashToken(rawToken);

    // Update ticket with QR token hash
    savedTicket.qrTokenHash = qrTokenHash;
    await queryRunner.manager.save(OfferTicket, savedTicket);

    // Store the raw token in metadata so we can return it to the user
    // (the raw token is only shown as QR code, hash is used for lookups)
    savedTicket.metadata = {
      ...(savedTicket.metadata || {}),
      qrData: rawToken,
    };
    await queryRunner.manager.save(OfferTicket, savedTicket);

    return savedTicket;
  }
}
