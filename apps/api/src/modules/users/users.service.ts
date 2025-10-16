import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EncryptionService } from '../../utils/encryption.util';
import { UserRole } from '../../common/decorators/roles.decorator';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private encryptionService: EncryptionService,
  ) {}

  async createStaff(createStaffDto: CreateStaffDto): Promise<Partial<User>> {
    const {
      email,
      name,
      password,
      roles,
      phone,
      language = 'ar',
      branchId,
    } = createStaffDto;

    // Check if email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const encryptedPhone = this.encryptionService.encrypt(phone);
      const existingPhoneUser = await this.userRepository.findOne({
        where: { phone: encryptedPhone },
      });
      if (existingPhoneUser) {
        throw new ConflictException('Phone number already exists');
      }
    }

    // Validate roles
    const validRoles = Object.values(UserRole);
    const invalidRoles = roles.filter((role) => !validRoles.includes(role));
    if (invalidRoles.length > 0) {
      throw new BadRequestException(
        `Invalid roles: ${invalidRoles.join(', ')}`,
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = this.userRepository.create({
      email,
      name,
      passwordHash,
      roles,
      phone: phone ? this.encryptionService.encrypt(phone) : undefined,
      language,
      isActive: true,
      branchId,
    });

    let savedUser: User;
    try {
      savedUser = await this.userRepository.save(user);
    } catch (e: any) {
      // Handle common DB errors to avoid 500
      if (e?.code === '23505') {
        // unique_violation
        throw new ConflictException('Email or phone already exists');
      }
      if (e?.code === '22P02') {
        // invalid_text_representation (e.g., invalid UUID for branchId)
        throw new BadRequestException('Invalid input format');
      }
      throw e;
    }

    // Create wallet if user role is included
    if (roles.includes(UserRole.USER)) {
      const wallet = this.walletRepository.create({
        userId: savedUser.id,
        balance: 0,
        loyaltyPoints: 0,
      });
      try {
        await this.walletRepository.save(wallet);
      } catch (e: any) {
        // If wallet creation fails due to constraint, log and continue to return user
        this.logger.error(`Wallet creation failed for user ${savedUser.id}: ${e?.message || e}`);
      }
    }

    this.logger.log(
      `Staff user created: ${savedUser.id} with roles: ${roles.join(', ')}`,
    );

    return {
      id: savedUser.id,
      email: savedUser.email,
      name: savedUser.name,
      roles: savedUser.roles,
      phone: phone,
      language: savedUser.language,
      isActive: savedUser.isActive,
      createdAt: savedUser.createdAt,
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    requester?: User,
  ): Promise<{
    users: Partial<User>[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.wallet', 'wallet')
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // Branch Manager can only see users in their branch
    if (requester?.roles?.includes(UserRole.BRANCH_MANAGER) && requester.branchId) {
      qb.andWhere('user.branchId = :branchId', { branchId: requester.branchId });
    }

    const [users, total] = await qb.getManyAndCount();

    const decryptedUsers = users.map((user) => ({
      id: user.id,
      phone: user.phone
        ? this.encryptionService.decrypt(user.phone)
        : undefined,
      email: user.email,
      name: user.name,
      roles: user.roles,
      language: user.language,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      wallet: user.wallet,
    }));

    return {
      users: decryptedUsers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, requester?: User): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['wallet', 'bookings', 'supportTickets'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Branch Manager restriction: cannot access users outside own branch
    if (
      requester?.roles?.includes(UserRole.BRANCH_MANAGER) &&
      requester.branchId &&
      user.branchId &&
      requester.branchId !== user.branchId
    ) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      phone: user.phone
        ? this.encryptionService.decrypt(user.phone)
        : undefined,
      email: user.email,
      name: user.name,
      roles: user.roles,
      language: user.language,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      wallet: user.wallet,
      bookings: user.bookings,
      supportTickets: user.supportTickets,
    };
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    // Update user
    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    this.logger.log(`User updated: ${updatedUser.id}`);

    return {
      id: updatedUser.id,
      phone: updatedUser.phone
        ? this.encryptionService.decrypt(updatedUser.phone)
        : undefined,
      email: updatedUser.email,
      name: updatedUser.name,
      roles: updatedUser.roles,
      language: updatedUser.language,
      isActive: updatedUser.isActive,
      updatedAt: updatedUser.updatedAt,
    };
  }

  async deactivate(id: string, requester?: User): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Branch manager can only deactivate users in their branch
    if (requester?.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!requester.branchId || user.branchId !== requester.branchId) {
        throw new ConflictException('Not allowed to deactivate this user');
      }
    }

    user.isActive = false;
    await this.userRepository.save(user);

    this.logger.log(`User deactivated: ${id}`);
  }

  async activate(id: string, requester?: User): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Branch manager can only activate users in their branch
    if (requester?.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!requester.branchId || user.branchId !== requester.branchId) {
        throw new ConflictException('Not allowed to activate this user');
      }
    }

    user.isActive = true;
    await this.userRepository.save(user);

    this.logger.log(`User activated: ${id}`);
  }

  async getStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    staffUsers: number;
    adminUsers: number;
    newUsersThisMonth: number;
  }> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { isActive: true },
    });

    const staffUsers = await this.userRepository
      .createQueryBuilder('user')
      .where(':role = ANY(user.roles)', { role: UserRole.STAFF })
      .getCount();

    const adminUsers = await this.userRepository
      .createQueryBuilder('user')
      .where(':role = ANY(user.roles)', { role: UserRole.ADMIN })
      .getCount();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newUsersThisMonth = await this.userRepository.count({
      where: {
        createdAt: {
          $gte: startOfMonth,
        } as any,
      },
    });

    return {
      totalUsers,
      activeUsers,
      staffUsers,
      adminUsers,
      newUsersThisMonth,
    };
  }

  async deleteHard(id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['bookings', 'supportTickets'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if ((user.bookings && user.bookings.length > 0) || (user.supportTickets && user.supportTickets.length > 0)) {
      throw new BadRequestException('User has related records; deactivate instead');
    }

    const wallet = await this.walletRepository.findOne({ where: { userId: id }, relations: ['transactions'] as any });
    if (wallet && (wallet as any).transactions && (wallet as any).transactions.length > 0) {
      throw new BadRequestException('User wallet has transactions; deactivate instead');
    }

    if (wallet) {
      await this.walletRepository.delete(wallet.id);
    }

    await this.userRepository.delete(id);
    this.logger.log(`User hard-deleted: ${id}`);
  }

  async deleteStaff(id: string, requester: User): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['bookings', 'supportTickets'],
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Branch managers can only delete staff from their own branch
    if (requester.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!requester.branchId || user.branchId !== requester.branchId) {
        throw new ForbiddenException('You can only delete staff from your own branch');
      }
      
      // Branch managers can only delete staff users, not other roles
      if (!user.roles?.includes(UserRole.STAFF)) {
        throw new ForbiddenException('You can only delete staff members');
      }
    }

    if ((user.bookings && user.bookings.length > 0) || (user.supportTickets && user.supportTickets.length > 0)) {
      throw new BadRequestException('User has related records; deactivate instead');
    }

    const wallet = await this.walletRepository.findOne({ where: { userId: id }, relations: ['transactions'] as any });
    if (wallet && (wallet as any).transactions && (wallet as any).transactions.length > 0) {
      throw new BadRequestException('User wallet has transactions; deactivate instead');
    }

    if (wallet) {
      await this.walletRepository.delete(wallet.id);
    }

    await this.userRepository.delete(id);
    this.logger.log(`Staff deleted by ${requester.id}: ${id}`);
  }
}
