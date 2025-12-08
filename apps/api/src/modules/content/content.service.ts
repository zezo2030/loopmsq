import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Between } from 'typeorm';
import { Branch } from '../../database/entities/branch.entity';
import { Addon } from '../../database/entities/addon.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { RedisService } from '../../utils/redis.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { getBookingSlotMinutes } from '../../config/booking.config';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);
  private readonly slotMinutes: number;
  private readonly maxBookingDurationHours = 12;

  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Addon)
    private addonRepository: Repository<Addon>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private redisService: RedisService,
    private configService: ConfigService,
    private realtime: RealtimeGateway,
  ) {
    this.slotMinutes = getBookingSlotMinutes(this.configService);
  }

  private isSlotAligned(date: Date): boolean {
    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const seconds = date.getUTCSeconds();
    const millis = date.getUTCMilliseconds();
    const minutes = date.getUTCMinutes();

    return seconds === 0 && millis === 0 && minutes % this.slotMinutes === 0;
  }

  private calculateBookingEnd(start: Date, durationHours: number): Date {
    return new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  }

  private countConsecutiveSlots(
    slotStart: Date,
    closeAt: Date,
    bookings: { start: Date; end: Date }[],
    intervalMs: number,
  ): number {
    let count = 0;
    let cursor = new Date(slotStart);

    while (cursor.getTime() + intervalMs <= closeAt.getTime()) {
      const cursorEnd = new Date(cursor.getTime() + intervalMs);
      const overlaps = bookings.some(
        (booking) => booking.start < cursorEnd && booking.end > cursor,
      );

      if (overlaps) {
        break;
      }

      count += 1;
      cursor = cursorEnd;
    }

    return count;
  }

  getSlotDurationMinutes(): number {
    return this.slotMinutes;
  }

  // Branch Management
  async createBranch(createBranchDto: CreateBranchDto): Promise<Branch> {
    // Extract hall data from DTO and merge into branch
    const {
      hallName_ar,
      hallName_en,
      hallPriceConfig,
      hallCapacity,
      hallIsDecorated,
      hallDescription_ar,
      hallDescription_en,
      hallFeatures,
      hallImages,
      hallVideoUrl,
      ...branchData
    } = createBranchDto;

    // Create branch with hall data merged
    const branch = this.branchRepository.create({
      ...branchData,
      priceConfig: hallPriceConfig || {
        basePrice: 500,
        hourlyRate: 100,
        pricePerPerson: 10,
        weekendMultiplier: 1.5,
        holidayMultiplier: 2.0,
        decorationPrice: 200,
      },
      isDecorated: hallIsDecorated ?? false,
      hallFeatures: hallFeatures || [],
      hallImages: hallImages || [],
      hallVideoUrl: hallVideoUrl || branchData.videoUrl,
      hallStatus: 'available',
    });

    const savedBranch = await this.branchRepository.save(branch);

    // Clear cache
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');
    await this.redisService.del(`branch:${savedBranch.id}`);

    this.logger.log(`Branch created: ${savedBranch.id} with merged hall data`);
    return savedBranch;
  }

  async findAllBranches(includeInactive: boolean = false): Promise<Branch[]> {
    const cacheKey = includeInactive ? 'branches:all' : 'branches:active';

    // Try to get from cache first
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Failed to get branches from cache: ${error.message}`);
      // Continue to database query if cache fails
    }

    try {
      const queryBuilder = this.branchRepository
        .createQueryBuilder('branch')
        .leftJoinAndSelect('branch.halls', 'halls')
        .orderBy('branch.createdAt', 'DESC');

      if (!includeInactive) {
        queryBuilder.where('branch.status = :status', { status: 'active' });
      }

      const branches = await queryBuilder.getMany();

      // Try to cache the result, but don't fail if caching fails
      try {
        await this.redisService.set(cacheKey, branches, 300);
      } catch (error) {
        this.logger.warn(`Failed to cache branches: ${error.message}`);
        // Continue even if caching fails
      }

      return branches;
    } catch (error) {
      this.logger.error(`Failed to fetch branches from database: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findBranchById(id: string): Promise<Branch> {
    const cacheKey = `branch:${id}`;

    // Try cache first
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Failed to get branch from cache: ${error.message}`);
      // Continue to database query if cache fails
    }

    try {
      const branch = await this.branchRepository.findOne({
        where: { id },
        relations: ['halls'],
      });

      if (!branch) {
        throw new NotFoundException('Branch not found');
      }

      // Try to cache the result, but don't fail if caching fails
      try {
        await this.redisService.set(cacheKey, branch, 600);
      } catch (error) {
        this.logger.warn(`Failed to cache branch: ${error.message}`);
        // Continue even if caching fails
      }

      return branch;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to fetch branch from database: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateBranch(
    id: string,
    updateData: Partial<CreateBranchDto>,
  ): Promise<Branch> {
    const branch = await this.findBranchById(id);

    // Extract hall data and merge into branch
    const {
      hallName_ar,
      hallName_en,
      hallPriceConfig,
      hallCapacity,
      hallIsDecorated,
      hallDescription_ar,
      hallDescription_en,
      hallFeatures,
      hallImages,
      hallVideoUrl,
      ...branchData
    } = updateData;

    // Update branch data
    Object.assign(branch, branchData);

    // Update hall data if provided
    if (hallPriceConfig) {
      branch.priceConfig = {
        basePrice: hallPriceConfig.basePrice,
        hourlyRate: hallPriceConfig.hourlyRate,
        pricePerPerson: hallPriceConfig.pricePerPerson ?? 0,
        weekendMultiplier: hallPriceConfig.weekendMultiplier,
        holidayMultiplier: hallPriceConfig.holidayMultiplier,
        decorationPrice: hallPriceConfig.decorationPrice,
      };
    }
    if (hallIsDecorated !== undefined) branch.isDecorated = hallIsDecorated;
    if (hallFeatures) branch.hallFeatures = hallFeatures;
    if (hallImages) branch.hallImages = hallImages;
    if (hallVideoUrl !== undefined) branch.hallVideoUrl = hallVideoUrl;

    const updatedBranch = await this.branchRepository.save(branch);

    // Clear cache
    await this.redisService.del(`branch:${id}`);
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');

    this.logger.log(`Branch updated: ${id}`);
    return updatedBranch;
  }

  async updateBranchStatus(
    id: string,
    status: 'active' | 'inactive' | 'maintenance',
  ): Promise<Branch> {
    const branch = await this.findBranchById(id);

    branch.status = status;
    const updatedBranch = await this.branchRepository.save(branch);

    // Clear cache
    await this.redisService.del(`branch:${id}`);
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');

    this.logger.log(`Branch status updated: ${id} -> ${status}`);
    return updatedBranch;
  }

  async uploadBranchCoverImage(branchId: string, filename: string): Promise<Branch> {
    const branch = await this.findBranchById(branchId);

    branch.coverImage = `/uploads/branches/${filename}`;
    const updatedBranch = await this.branchRepository.save(branch);

    // Clear cache
    await this.redisService.del(`branch:${branchId}`);
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');

    this.logger.log(`Branch cover image updated: ${branchId}`);
    return updatedBranch;
  }

  async uploadBranchImages(branchId: string, filenames: string[]): Promise<Branch> {
    const branch = await this.findBranchById(branchId);

    const imageUrls = filenames.map(filename => `/uploads/branches/${filename}`);
    branch.images = [...(branch.images || []), ...imageUrls];
    
    const updatedBranch = await this.branchRepository.save(branch);

    // Clear cache
    await this.redisService.del(`branch:${branchId}`);
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');

    this.logger.log(`Branch images updated: ${branchId}`);
    return updatedBranch;
  }

  async deleteBranchImage(branchId: string, filename: string): Promise<Branch> {
    const branch = await this.findBranchById(branchId);

    const imageUrl = `/uploads/branches/${filename}`;
    
    // Remove from cover image if it matches
    if (branch.coverImage === imageUrl) {
      branch.coverImage = null;
    }
    
    // Remove from images array
    if (branch.images) {
      branch.images = branch.images.filter(img => img !== imageUrl);
    }
    
    const updatedBranch = await this.branchRepository.save(branch);

    // Clear cache
    await this.redisService.del(`branch:${branchId}`);
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');

    this.logger.log(`Branch image deleted: ${branchId}`);
    return updatedBranch;
  }

  // Branch Hall Images Management (merged into branch)
  async uploadBranchHallImages(branchId: string, filenames: string[]): Promise<Branch> {
    const branch = await this.findBranchById(branchId);

    const imageUrls = filenames.map((filename) => `/uploads/branches/halls/${filename}`);
    branch.hallImages = [...(branch.hallImages || []), ...imageUrls];

    const updatedBranch = await this.branchRepository.save(branch);

    // Clear cache
    await this.redisService.del(`branch:${branchId}`);
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');

    this.logger.log(`Branch hall images updated: ${branchId}`);
    return updatedBranch;
  }

  async findAllHalls(branchId?: string): Promise<Hall[]> {
    const cacheKey = branchId ? `halls:branch:${branchId}` : 'halls:all';

    // Try cache first
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Failed to get halls from cache: ${error.message}`);
      // Continue to database query if cache fails
    }

    try {
      const queryBuilder = this.hallRepository
        .createQueryBuilder('hall')
        .leftJoinAndSelect('hall.branch', 'branch')
        .orderBy('hall.createdAt', 'DESC');

      if (branchId) {
        queryBuilder.where('hall.branchId = :branchId', { branchId });
      }

      const halls = await queryBuilder.getMany();

      // Try to cache the result, but don't fail if caching fails
      try {
        await this.redisService.set(cacheKey, halls, 300);
      } catch (error) {
        this.logger.warn(`Failed to cache halls: ${error.message}`);
        // Continue even if caching fails
      }

      return halls;
    } catch (error) {
      this.logger.error(`Failed to fetch halls from database: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findHallById(id: string): Promise<Hall> {
    const cacheKey = `hall:${id}`;

    // Try cache first
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Failed to get hall from cache: ${error.message}`);
      // Continue to database query if cache fails
    }

    try {
      const hall = await this.hallRepository.findOne({
        where: { id },
        relations: ['branch'],
      });

      if (!hall) {
        throw new NotFoundException('Hall not found');
      }

      // Try to cache the result, but don't fail if caching fails
      try {
        await this.redisService.set(cacheKey, hall, 600);
      } catch (error) {
        this.logger.warn(`Failed to cache hall: ${error.message}`);
        // Continue even if caching fails
      }

      return hall;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to fetch hall from database: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateHall(
    id: string,
    updateData: Partial<CreateHallDto>,
  ): Promise<Hall> {
    const hall = await this.findHallById(id);

    Object.assign(hall, updateData);
    const updatedHall = await this.hallRepository.save(hall);

    // Clear cache
    await this.redisService.del(`branch:${branchId}`);
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');

    this.logger.log(`Branch hall image deleted: ${branchId}`);
    return updatedBranch;
  }

  async updateBranchHallStatus(
    id: string,
    status: 'available' | 'maintenance' | 'reserved',
  ): Promise<Branch> {
    const branch = await this.findBranchById(id);

    branch.hallStatus = status;
    const updatedBranch = await this.branchRepository.save(branch);

    // Clear cache
    await this.redisService.del(`branch:${id}`);
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');

    this.logger.log(`Branch hall status updated: ${id} -> ${status}`);
    return updatedBranch;
  }

  // Availability Check
  async checkBranchAvailability(
    branchId: string,
    startTime: Date,
    durationHours: number,
    persons?: number,
  ): Promise<boolean> {
    try {
      this.logger.log(`Checking availability for branch: ${branchId}, startTime: ${startTime}, duration: ${durationHours} hours`);

      if (Number.isNaN(startTime.getTime())) {
        this.logger.warn(`Invalid start time provided for branch availability: ${startTime}`);
        return false;
      }

      if (!this.isSlotAligned(startTime)) {
        this.logger.log(
          `Requested start ${startTime.toISOString()} is not aligned with ${this.slotMinutes}-minute slots`,
        );
        return false;
      }

      // Working hours enforcement based on branch workingHours
      const branch = await this.findBranchById(branchId);
      const wh: any = branch?.workingHours || {};
      const day = startTime.getDay(); // 0 Sunday .. 6 Saturday
      const dayKeys = [
        String(day),
        ['sun','mon','tue','wed','thu','fri','sat'][day],
        ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][day],
      ];
      let dayCfg: any;
      for (const k of dayKeys) {
        if (wh && wh[k] != null) { dayCfg = wh[k]; break; }
      }
      if (!dayCfg) {
        // If no config for this day, allow by default
        this.logger.warn(`No working hours for day ${day} on branch ${branch?.id}`);
      } else {
        if (dayCfg.closed === true) {
          this.logger.log(`Branch closed on day ${day}`);
          return false;
        }
        const openStr: string | undefined = dayCfg.open;
        const closeStr: string | undefined = dayCfg.close;
        if (openStr && closeStr) {
          const [oH, oM] = openStr.split(':').map((v: string) => parseInt(v, 10));
          const [cH, cM] = closeStr.split(':').map((v: string) => parseInt(v, 10));
          const openAt = new Date(startTime);
          openAt.setHours(oH || 0, oM || 0, 0, 0);
          const closeAt = new Date(startTime);
          closeAt.setHours(cH || 0, cM || 0, 0, 0);
          const endTime = this.calculateBookingEnd(startTime, durationHours);
          if (startTime < openAt || endTime > closeAt) {
            this.logger.log(`Requested time ${startTime.toISOString()} - ${endTime.toISOString()} is outside working hours ${openAt.toISOString()} - ${closeAt.toISOString()}`);
            return false;
          }
        }
      }

      const requestEnd = this.calculateBookingEnd(startTime, durationHours);
      const statuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
      const bufferMs = this.maxBookingDurationHours * 60 * 60 * 1000;
      const searchStart = new Date(startTime.getTime() - bufferMs);
      const searchEnd = new Date(requestEnd.getTime() + bufferMs);

      const existingBookings = await this.bookingRepository.find({
        where: {
          branchId,
          status: In(statuses),
          startTime: Between(searchStart, searchEnd),
        },
        select: ['id', 'startTime', 'durationHours', 'status', 'persons'],
      });

      let hasOverlap = false;
      let totalOverlappingPersons = 0;
      existingBookings.forEach((booking) => {
        const bookingEnd = this.calculateBookingEnd(
          booking.startTime,
          booking.durationHours,
        );
        const overlaps =
          booking.startTime < requestEnd && bookingEnd > startTime;

        if (overlaps) {
          this.logger.log(
            `Overlap detected with booking ${booking.id}: ${booking.startTime.toISOString()} - ${bookingEnd.toISOString()}`,
          );
          hasOverlap = true;
          // Sum persons for a conservative capacity check
          totalOverlappingPersons += (booking as any).persons ?? 0;
        }
      });

      // Capacity-aware: only block if capacity would be exceeded
      if (hasOverlap) {
        const reqPersons = Math.max(1, persons ?? 1);
        const remaining = (branch.capacity ?? 0) - totalOverlappingPersons;
        if (remaining < reqPersons) {
          return false;
        }
      }

      this.logger.log(`Branch availability check passed (within working hours) for branch: ${branchId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error checking branch availability: ${error.message}`, error.stack);
      // Return true as fallback to allow booking
      return true;
    }
  }

  async getBranchSlots(
    branchId: string,
    date: Date,
    durationHours: number = 1,
    slotMinutesOverride?: number,
    persons?: number,
  ): Promise<
    {
      start: Date;
      end: Date;
      available: boolean;
      consecutiveSlots: number;
    }[]
  > {
    try {
      const branch = await this.findBranchById(branchId);

      const targetDate = new Date(date);
      if (Number.isNaN(targetDate.getTime())) {
        throw new BadRequestException('Invalid date');
      }
      targetDate.setHours(0, 0, 0, 0);

      const slotMinutesToUse =
        slotMinutesOverride && slotMinutesOverride > 0
          ? slotMinutesOverride
          : this.slotMinutes;
      const intervalMs = slotMinutesToUse * 60 * 1000;
      const normalizedDurationHours =
        Number.isFinite(durationHours) && durationHours > 0
          ? durationHours
          : 1;
      const requiredSlots = Math.max(
        1,
        Math.ceil((normalizedDurationHours * 60) / slotMinutesToUse),
      );

      const workingHours = branch?.workingHours || {};
      const day = targetDate.getDay();
      const dayKeys = [
        String(day),
        ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][day],
        ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day],
      ];
      let dayCfg: any;
      for (const key of dayKeys) {
        if (workingHours && workingHours[key]) {
          dayCfg = workingHours[key];
          break;
        }
      }

      if (!dayCfg) {
        this.logger.warn(`No working hours configured for date ${targetDate.toISOString()} on branch ${branch?.id}`);
        return [];
      }
      if (dayCfg.closed === true) {
        this.logger.log(`Branch closed on ${targetDate.toISOString()} (day ${day})`);
        return [];
      }

      const openStr: string | undefined = dayCfg.open;
      const closeStr: string | undefined = dayCfg.close;
      if (!openStr || !closeStr) {
        this.logger.warn(`Incomplete working hours for branch ${branch?.id} on day ${day}`);
        return [];
      }

      const [oH, oM] = openStr.split(':').map((v: string) => parseInt(v, 10));
      const [cH, cM] = closeStr.split(':').map((v: string) => parseInt(v, 10));
      const openAt = new Date(targetDate);
      openAt.setHours(oH || 0, oM || 0, 0, 0);
      const closeAt = new Date(targetDate);
      closeAt.setHours(cH || 0, cM || 0, 0, 0);

      if (openAt >= closeAt) {
        this.logger.warn(`Invalid working hours window for branch ${branch?.id} on ${targetDate.toISOString()}`);
        return [];
      }

      const alignedOpen = new Date(openAt);
      alignedOpen.setSeconds(0, 0);
      const openRemainder =
        (alignedOpen.getHours() * 60 + alignedOpen.getMinutes()) %
        slotMinutesToUse;
      if (openRemainder !== 0) {
        alignedOpen.setMinutes(alignedOpen.getMinutes() + (slotMinutesToUse - openRemainder));
      }

      const alignedClose = new Date(closeAt);
      alignedClose.setSeconds(0, 0);
      const closeRemainder =
        (alignedClose.getHours() * 60 + alignedClose.getMinutes()) %
        slotMinutesToUse;
      if (closeRemainder !== 0) {
        alignedClose.setMinutes(alignedClose.getMinutes() - closeRemainder);
      }

      if (alignedOpen >= alignedClose) {
        this.logger.warn(`Working hours for branch ${branch?.id} do not produce any slots after alignment`);
        return [];
      }

      const statuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
      const bufferMs = this.maxBookingDurationHours * 60 * 60 * 1000;
      const searchStart = new Date(alignedOpen.getTime() - bufferMs);
      const searchEnd = new Date(alignedClose.getTime() + bufferMs);

      const existingBookings = await this.bookingRepository.find({
        where: {
          branchId,
          status: In(statuses),
          startTime: Between(searchStart, searchEnd),
        },
        select: ['id', 'startTime', 'durationHours', 'persons'],
      });

      const normalizedBookings = existingBookings.map((booking) => {
        const bookingStart = new Date(booking.startTime);
        return {
          id: booking.id,
          start: bookingStart,
          end: this.calculateBookingEnd(bookingStart, booking.durationHours),
          persons: (booking as any).persons ?? 0,
        };
      });

      const reqPersons = Math.max(1, persons ?? 1);

      const canFitAt = (slotStart: Date, slotEnd: Date): boolean => {
        const overlappingPersons = normalizedBookings
          .filter((b) => b.start < slotEnd && b.end > slotStart)
          .reduce((sum, b) => sum + (b.persons || 0), 0);
        const remaining = (branch.capacity ?? 0) - overlappingPersons;
        return remaining >= reqPersons;
      };

      const slots: {
        start: Date;
        end: Date;
        available: boolean;
        consecutiveSlots: number;
      }[] = [];

      for (
        let slotStart = new Date(alignedOpen);
        slotStart.getTime() + intervalMs <= alignedClose.getTime();
        slotStart = new Date(slotStart.getTime() + intervalMs)
      ) {
        const slotEnd = new Date(slotStart.getTime() + intervalMs);
        // Count how many consecutive slots from slotStart can fit reqPersons
        let chain = 0;
        let cursor = new Date(slotStart);
        while (cursor.getTime() + intervalMs <= alignedClose.getTime()) {
          const cursorEnd = new Date(cursor.getTime() + intervalMs);
          if (!canFitAt(cursor, cursorEnd)) break;
          chain += 1;
          cursor = cursorEnd;
        }
        const supportsDuration = chain >= requiredSlots;

        slots.push({
          start: new Date(slotStart),
          end: slotEnd,
          available: supportsDuration,
          consecutiveSlots: chain,
        });
      }

      return slots;
    } catch (error) {
      this.logger.error(`Error generating slots for branch ${branchId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Pricing Calculation
  async calculateBranchPrice(
    branchId: string,
    startTime: Date,
    durationHours: number,
    persons: number,
  ): Promise<{
    basePrice: number;
    hourlyPrice: number;
    personsPrice: number;
    pricePerPerson: number;
    multiplier: number;
    decorationPrice: number;
    totalPrice: number;
  }> {
    const branch = await this.findBranchById(branchId);
    if (!branch.priceConfig) {
      throw new BadRequestException('Branch does not have pricing configuration');
    }
    const { priceConfig } = branch;

    // Determine multiplier based on day type
    const dayOfWeek = startTime.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday, Saturday

    // TODO: Add holiday detection logic
    const isHoliday = false;

    let multiplier = 1;
    if (isHoliday) {
      multiplier = priceConfig.holidayMultiplier;
    } else if (isWeekend) {
      multiplier = priceConfig.weekendMultiplier;
    }

    const basePrice = priceConfig.basePrice;
    const hourlyPrice = priceConfig.hourlyRate * durationHours;
    const pricePerPerson = priceConfig.pricePerPerson || 0;
    const personsPrice = pricePerPerson * persons;
    const decorationPrice = branch.isDecorated
      ? priceConfig.decorationPrice || 0
      : 0;

    const subtotal = basePrice + hourlyPrice + personsPrice + decorationPrice;
    const totalPrice = subtotal * multiplier;

    return {
      basePrice,
      hourlyPrice,
      personsPrice,
      pricePerPerson,
      multiplier,
      decorationPrice,
      totalPrice: Math.round(totalPrice * 100) / 100, // Round to 2 decimal places
    };
  }

  // Add-ons fetching
  async getBranchAddOns(branchId: string): Promise<
    { id: string; name: string; price: number; defaultQuantity: number }[]
  > {
    // Pull active add-ons for the branch
    const branchAddons = await this.addonRepository.find({ 
      where: { isActive: true, branchId } 
    });

    return branchAddons.map((a) => ({
      id: a.id,
      name: a.name,
      price: Number(a.price),
      defaultQuantity: a.defaultQuantity || 1,
    }));
  }

  // Admin: CRUD for Addons
  async createAddon(data: {
    name: string;
    price: number;
    defaultQuantity?: number;
    isActive?: boolean;
    branchId?: string | null;
  }): Promise<Addon> {
    const addon = this.addonRepository.create({
      name: data.name,
      price: data.price,
      defaultQuantity: data.defaultQuantity ?? 1,
      isActive: data.isActive ?? true,
      branchId: data.branchId ?? null,
    });
    return this.addonRepository.save(addon);
  }

  async listAddons(filter?: {
    branchId?: string;
    isActive?: boolean;
  }): Promise<Addon[]> {
    const where: any = {};
    if (filter?.branchId) where.branchId = filter.branchId;
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;
    return this.addonRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async updateAddon(id: string, update: Partial<Addon>): Promise<Addon> {
    const found = await this.addonRepository.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Addon not found');
    Object.assign(found, update);
    return this.addonRepository.save(found);
  }

  async deleteAddon(id: string): Promise<void> {
    await this.addonRepository.delete(id);
  }
}
