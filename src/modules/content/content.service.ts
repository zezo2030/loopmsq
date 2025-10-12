import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../database/entities/branch.entity';
import { Hall } from '../../database/entities/hall.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateHallDto } from './dto/create-hall.dto';
import { RedisService } from '../../utils/redis.service';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Hall)
    private hallRepository: Repository<Hall>,
    private redisService: RedisService,
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
      .where('hall.status = :status', { status: 'available' })
      .orderBy('hall.createdAt', 'DESC');

    if (branchId) {
      queryBuilder.andWhere('hall.branchId = :branchId', { branchId });
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
    return updatedHall;
  }

  // Availability Check
  async checkHallAvailability(
    hallId: string,
    startTime: Date,
    durationHours: number,
  ): Promise<boolean> {
    const endTime = new Date(
      startTime.getTime() + durationHours * 60 * 60 * 1000,
    );

    const conflictingBookings = await this.branchRepository.query(
      `
      SELECT COUNT(*) as count
      FROM bookings b
      WHERE b.hallId = $1
        AND b.status IN ('confirmed', 'pending')
        AND (
          (b.startTime <= $2 AND (b.startTime + INTERVAL '1 hour' * b.durationHours) > $2)
          OR (b.startTime < $3 AND (b.startTime + INTERVAL '1 hour' * b.durationHours) >= $3)
          OR (b.startTime >= $2 AND b.startTime < $3)
        )
    `,
      [hallId, startTime, endTime],
    );

    return parseInt(conflictingBookings[0].count) === 0;
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
    const decorationPrice = hall.isDecorated
      ? priceConfig.decorationPrice || 0
      : 0;

    const subtotal = basePrice + hourlyPrice + decorationPrice;
    const totalPrice = subtotal * multiplier;

    return {
      basePrice,
      hourlyPrice,
      multiplier,
      decorationPrice,
      totalPrice: Math.round(totalPrice * 100) / 100, // Round to 2 decimal places
    };
  }
}
