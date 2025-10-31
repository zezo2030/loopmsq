import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Branch } from '../../database/entities/branch.entity';
import { Hall } from '../../database/entities/hall.entity';
import { Addon } from '../../database/entities/addon.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateHallDto } from './dto/create-hall.dto';
import { RedisService } from '../../utils/redis.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Hall)
    private hallRepository: Repository<Hall>,
    @InjectRepository(Addon)
    private addonRepository: Repository<Addon>,
    private redisService: RedisService,
    private realtime: RealtimeGateway,
  ) {}

  // Branch Management
  async createBranch(createBranchDto: CreateBranchDto): Promise<Branch> {
    const branch = this.branchRepository.create(createBranchDto);
    const savedBranch = await this.branchRepository.save(branch);

    // Clear cache
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');

    this.logger.log(`Branch created: ${savedBranch.id}`);
    return savedBranch;
  }

  async findAllBranches(includeInactive: boolean = false): Promise<Branch[]> {
    const cacheKey = includeInactive ? 'branches:all' : 'branches:active';

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const queryBuilder = this.branchRepository
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.halls', 'halls')
      .orderBy('branch.createdAt', 'DESC');

    if (!includeInactive) {
      queryBuilder.where('branch.status = :status', { status: 'active' });
    }

    const branches = await queryBuilder.getMany();

    // Cache for 5 minutes
    await this.redisService.set(cacheKey, branches, 300);

    return branches;
  }

  async findBranchById(id: string): Promise<Branch> {
    const cacheKey = `branch:${id}`;

    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const branch = await this.branchRepository.findOne({
      where: { id },
      relations: ['halls'],
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Cache for 10 minutes
    await this.redisService.set(cacheKey, branch, 600);

    return branch;
  }

  async updateBranch(
    id: string,
    updateData: Partial<CreateBranchDto>,
  ): Promise<Branch> {
    const branch = await this.findBranchById(id);

    Object.assign(branch, updateData);
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

  // Hall Management
  async createHall(createHallDto: CreateHallDto): Promise<Hall> {
    // Verify branch exists
    const branch = await this.findBranchById(createHallDto.branchId);

    const hall = this.hallRepository.create(createHallDto);
    const savedHall = await this.hallRepository.save(hall);

    // Clear branch cache
    await this.redisService.del(`branch:${createHallDto.branchId}`);
    await this.redisService.del('branches:all');
    await this.redisService.del('branches:active');
    // Clear halls caches so new halls appear immediately
    await this.redisService.del(`halls:branch:${createHallDto.branchId}`);
    await this.redisService.del('halls:all');

    this.logger.log(
      `Hall created: ${savedHall.id} in branch ${createHallDto.branchId}`,
    );
    return savedHall;
  }

  async findAllHalls(branchId?: string): Promise<Hall[]> {
    const cacheKey = branchId ? `halls:branch:${branchId}` : 'halls:all';

    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const queryBuilder = this.hallRepository
      .createQueryBuilder('hall')
      .leftJoinAndSelect('hall.branch', 'branch')
      .orderBy('hall.createdAt', 'DESC');

    if (branchId) {
      queryBuilder.where('hall.branchId = :branchId', { branchId });
    }

    const halls = await queryBuilder.getMany();

    // Cache for 5 minutes
    await this.redisService.set(cacheKey, halls, 300);

    return halls;
  }

  async findHallById(id: string): Promise<Hall> {
    const cacheKey = `hall:${id}`;

    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const hall = await this.hallRepository.findOne({
      where: { id },
      relations: ['branch'],
    });

    if (!hall) {
      throw new NotFoundException('Hall not found');
    }

    // Cache for 10 minutes
    await this.redisService.set(cacheKey, hall, 600);

    return hall;
  }

  async updateHall(
    id: string,
    updateData: Partial<CreateHallDto>,
  ): Promise<Hall> {
    const hall = await this.findHallById(id);

    Object.assign(hall, updateData);
    const updatedHall = await this.hallRepository.save(hall);

    // Clear cache
    await this.redisService.del(`hall:${id}`);
    await this.redisService.del(`halls:branch:${hall.branchId}`);
    await this.redisService.del('halls:all');
    await this.redisService.del(`branch:${hall.branchId}`);

    this.logger.log(`Hall updated: ${id}`);
    // Broadcast hall update (non-status changes may still matter for clients)
    this.realtime.emitHallUpdated(id, { id, status: updatedHall.status });
    return updatedHall;
  }

  async uploadHallImages(hallId: string, filenames: string[]): Promise<Hall> {
    const hall = await this.findHallById(hallId);

    const imageUrls = filenames.map((filename) => `/uploads/halls/${filename}`);
    hall.images = [...(hall.images || []), ...imageUrls];

    const updatedHall = await this.hallRepository.save(hall);

    // Clear cache
    await this.redisService.del(`hall:${hallId}`);
    await this.redisService.del(`halls:branch:${hall.branchId}`);
    await this.redisService.del('halls:all');
    await this.redisService.del(`branch:${hall.branchId}`);

    this.logger.log(`Hall images updated: ${hallId}`);
    return updatedHall;
  }

  async deleteHallImage(hallId: string, filename: string): Promise<Hall> {
    const hall = await this.findHallById(hallId);

    const imageUrl = `/uploads/halls/${filename}`;
    if (hall.images) {
      hall.images = hall.images.filter((img) => img !== imageUrl);
    }

    const updatedHall = await this.hallRepository.save(hall);

    // Clear cache
    await this.redisService.del(`hall:${hallId}`);
    await this.redisService.del(`halls:branch:${hall.branchId}`);
    await this.redisService.del('halls:all');
    await this.redisService.del(`branch:${hall.branchId}`);

    this.logger.log(`Hall image deleted: ${hallId}`);
    return updatedHall;
  }

  async updateHallStatus(
    id: string,
    status: 'available' | 'maintenance' | 'reserved',
  ): Promise<Hall> {
    const hall = await this.findHallById(id);

    hall.status = status;
    const updatedHall = await this.hallRepository.save(hall);

    // Clear cache
    await this.redisService.del(`hall:${id}`);
    await this.redisService.del(`halls:branch:${hall.branchId}`);
    await this.redisService.del('halls:all');

    this.logger.log(`Hall status updated: ${id} -> ${status}`);
    // Broadcast realtime status update
    this.realtime.emitHallUpdated(id, { id, status });
    return updatedHall;
  }

  async deleteHall(id: string): Promise<void> {
    const hall = await this.findHallById(id);
    
    // Check if hall has any bookings
    // TODO: Add booking check when booking system is implemented
    // Defensive: nullify hallId in any existing bookings (in case FK isn't set to SET NULL in DB)
    try {
      await this.branchRepository.query(
        `UPDATE bookings SET "hallId" = NULL WHERE "hallId" = $1`,
        [id],
      );
    } catch {
      // ignore - best effort
    }

    await this.hallRepository.delete(id);

    // Clear cache
    await this.redisService.del(`hall:${id}`);
    await this.redisService.del(`halls:branch:${hall.branchId}`);
    await this.redisService.del('halls:all');
    await this.redisService.del(`branch:${hall.branchId}`);

    this.logger.log(`Hall deleted: ${id}`);
  }

  // Availability Check
  async checkHallAvailability(
    hallId: string,
    startTime: Date,
    durationHours: number,
  ): Promise<boolean> {
    try {
      this.logger.log(`Checking availability for hall: ${hallId}, startTime: ${startTime}, duration: ${durationHours} hours`);
      // Working hours enforcement based on branch workingHours
      const hall = await this.findHallById(hallId);
      const branch = hall.branch;
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
          const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
          if (startTime < openAt || endTime > closeAt) {
            this.logger.log(`Requested time ${startTime.toISOString()} - ${endTime.toISOString()} is outside working hours ${openAt.toISOString()} - ${closeAt.toISOString()}`);
            return false;
          }
        }
      }

      // TODO: Check against existing bookings calendar
      this.logger.log(`Hall availability check passed (within working hours) for hall: ${hallId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error checking hall availability: ${error.message}`, error.stack);
      // Return true as fallback to allow booking
      return true;
    }
  }

  // Pricing Calculation
  async calculateHallPrice(
    hallId: string,
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
    const hall = await this.findHallById(hallId);
    const { priceConfig } = hall;

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
    const decorationPrice = hall.isDecorated
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
  async getHallAddOns(hallId: string): Promise<
    { id: string; name: string; price: number; defaultQuantity: number }[]
  > {
    const hall = await this.findHallById(hallId);

    // Pull active add-ons for the hall and its branch
    const [hallAddons, branchAddons] = await Promise.all([
      this.addonRepository.find({ where: { isActive: true, hallId: hall.id } }),
      this.addonRepository.find({ where: { isActive: true, branchId: hall.branchId, hallId: IsNull() } }),
    ]);

    // Merge, preferring hall-specific when duplicate names exist
    const merged = new Map<string, Addon>();
    for (const a of branchAddons) merged.set(a.name.toLowerCase(), a);
    for (const a of hallAddons) merged.set(a.name.toLowerCase(), a);

    return Array.from(merged.values()).map((a) => ({
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
    hallId?: string | null;
  }): Promise<Addon> {
    const addon = this.addonRepository.create({
      name: data.name,
      price: data.price,
      defaultQuantity: data.defaultQuantity ?? 1,
      isActive: data.isActive ?? true,
      branchId: data.branchId ?? null,
      hallId: data.hallId ?? null,
    });
    return this.addonRepository.save(addon);
  }

  async listAddons(filter?: {
    branchId?: string;
    hallId?: string;
    isActive?: boolean;
  }): Promise<Addon[]> {
    const where: any = {};
    if (filter?.branchId) where.branchId = filter.branchId;
    if (filter?.hallId) where.hallId = filter.hallId;
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
