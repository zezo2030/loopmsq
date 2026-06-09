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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EncryptionService } from '../../utils/encryption.util';
import { toSaudiE164 } from '../../utils/phone.util';
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

    const normalizedPhone = phone ? (toSaudiE164(phone) ?? undefined) : undefined;
    if (phone && !normalizedPhone) {
      throw new BadRequestException(
        'Invalid Saudi phone number. Enter 9 digits starting with 5',
      );
    }

    // Check if phone already exists (if provided)
    if (normalizedPhone) {
      const encryptedPhone = this.encryptionService.encrypt(normalizedPhone);
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
      phone: normalizedPhone
        ? this.encryptionService.encrypt(normalizedPhone)
        : undefined,
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
        this.logger.error(
          `Wallet creation failed for user ${savedUser.id}: ${e?.message || e}`,
        );
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
      phone: normalizedPhone,
      language: savedUser.language,
      isActive: savedUser.isActive,
      createdAt: savedUser.createdAt,
    };
  }

  async createUser(
    createUserDto: CreateUserDto,
    requester?: User,
  ): Promise<Partial<User>> {
    const { phone, name, email, password, language = 'ar' } = createUserDto;

    if (phone) {
      const encryptedPhone = this.encryptionService.encrypt(phone);
      const existingPhoneUser = await this.userRepository.findOne({
        where: { phone: encryptedPhone },
      });
      if (existingPhoneUser) {
        throw new ConflictException('Phone number already exists');
      }
    }

    if (email) {
      const existingUser = await this.userRepository.findOne({
        where: { email },
      });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = this.userRepository.create({
      phone: phone ? this.encryptionService.encrypt(phone) : undefined,
      name,
      email,
      passwordHash,
      roles: [UserRole.USER],
      language,
      isActive: true,
    });

    let savedUser: User;
    try {
      savedUser = await this.userRepository.save(user);
    } catch (e: any) {
      if (e?.code === '23505') {
        throw new ConflictException('Email or phone already exists');
      }
      if (e?.code === '22P02') {
        throw new BadRequestException('Invalid input format');
      }
      throw e;
    }

    const wallet = this.walletRepository.create({
      userId: savedUser.id,
      balance: 0,
      loyaltyPoints: 0,
    });
    try {
      await this.walletRepository.save(wallet);
    } catch (e: any) {
      this.logger.error(
        `Wallet creation failed for user ${savedUser.id}: ${e?.message || e}`,
      );
    }

    this.logger.log(
      `User created: ${savedUser.id} by ${requester?.id || 'system'}`,
    );

    return {
      id: savedUser.id,
      phone: phone,
      email: savedUser.email,
      name: savedUser.name,
      roles: savedUser.roles,
      language: savedUser.language,
      isActive: savedUser.isActive,
      createdAt: savedUser.createdAt,
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    requester?: User,
    options?: { role?: string; q?: string },
  ): Promise<{
    users: Partial<User>[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.wallet', 'wallet')
      .orderBy('user.createdAt', 'DESC');

    // Branch Manager can only see users in their branch
    if (
      requester?.roles?.includes(UserRole.BRANCH_MANAGER) &&
      requester.branchId
    ) {
      qb.andWhere('user.branchId = :branchId', {
        branchId: requester.branchId,
      });
    }

    if (options?.role) {
      qb.andWhere(':role = ANY(user.roles)', { role: options.role });
    }

    const q = options?.q?.trim();
    if (q) {
      qb.andWhere(
        '(LOWER(user.name) LIKE LOWER(:q) OR LOWER(user.email) LIKE LOWER(:q))',
        { q: `%${q}%` },
      );
    }

    const [users, total] = await qb
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

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
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findOne(id: string, requester?: User): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['wallet', 'bookings', 'supportTickets', 'branch'],
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
      branchId: user.branchId,
      branch: user.branch,
      permissions: user.permissions || null,
      wallet: user.wallet,
      bookings: user.bookings,
      supportTickets: user.supportTickets,
    } as any;
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

    // Check phone uniqueness if phone is being updated
    if (updateUserDto.phone) {
      const encryptedPhone = this.encryptionService.encrypt(
        updateUserDto.phone,
      );
      if (encryptedPhone !== user.phone) {
        const existingPhoneUser = await this.userRepository.findOne({
          where: { phone: encryptedPhone },
        });
        if (existingPhoneUser) {
          throw new ConflictException('Phone number already exists');
        }
        // Update phone with encrypted value
        user.phone = encryptedPhone;
      }
      // Remove phone from updateUserDto to avoid double assignment
      delete updateUserDto.phone;
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

  async listBranchManagerPermissions(): Promise<
    Array<{
      id: string;
      name: string;
      email?: string;
      branchId?: string;
      isActive: boolean;
      permissions: {
        canViewRevenue: boolean;
        canViewBookingAmounts: boolean;
        canManageWallets: boolean;
      };
    }>
  > {
    const managers = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.branch', 'branch')
      .where(':role = ANY(user.roles)', { role: UserRole.BRANCH_MANAGER })
      .orderBy('user.createdAt', 'DESC')
      .getMany();

    return managers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      branchId: u.branchId,
      branchName: (u.branch as any)?.nameAr || (u.branch as any)?.nameEn,
      isActive: u.isActive,
      permissions: {
        canViewRevenue: u.permissions?.canViewRevenue ?? true,
        canViewBookingAmounts: u.permissions?.canViewBookingAmounts ?? true,
        // Wallet management is opt-in; defaults to false so existing managers
        // keep their pre-feature behaviour until an admin grants the flag.
        canManageWallets: u.permissions?.canManageWallets ?? false,
      },
    })) as any;
  }

  async updatePermissions(
    id: string,
    body: {
      canViewRevenue?: boolean;
      canViewBookingAmounts?: boolean;
      canManageWallets?: boolean;
    },
  ): Promise<{
    id: string;
    permissions: {
      canViewRevenue: boolean;
      canViewBookingAmounts: boolean;
      canManageWallets: boolean;
    };
  }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.roles?.includes(UserRole.BRANCH_MANAGER)) {
      throw new BadRequestException(
        'Permissions can only be set for branch managers',
      );
    }

    const current = user.permissions || {};
    const next = {
      canViewRevenue:
        typeof body.canViewRevenue === 'boolean'
          ? body.canViewRevenue
          : (current.canViewRevenue ?? true),
      canViewBookingAmounts:
        typeof body.canViewBookingAmounts === 'boolean'
          ? body.canViewBookingAmounts
          : (current.canViewBookingAmounts ?? true),
      canManageWallets:
        typeof body.canManageWallets === 'boolean'
          ? body.canManageWallets
          : (current.canManageWallets ?? false),
    };

    user.permissions = next;
    await this.userRepository.save(user);
    this.logger.log(
      `Permissions updated for ${id}: ${JSON.stringify(next)}`,
    );

    return { id, permissions: next };
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

  async resetPassword(
    id: string,
    newPassword: string,
    requester: User,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isStaff = user.roles?.includes(UserRole.STAFF);
    const isBranchManager = user.roles?.includes(UserRole.BRANCH_MANAGER);
    const isAdmin = user.roles?.includes(UserRole.ADMIN);

    if (isAdmin) {
      throw new BadRequestException('Cannot reset admin password');
    }

    if (!isStaff && !isBranchManager) {
      throw new BadRequestException(
        'Password reset is only available for staff and branch managers',
      );
    }

    if (requester.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!requester.branchId || user.branchId !== requester.branchId) {
        throw new ForbiddenException(
          'You can only reset passwords for staff in your branch',
        );
      }
      if (!isStaff) {
        throw new ForbiddenException(
          'You can only reset passwords for staff members',
        );
      }
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.save(user);

    this.logger.log(`Password reset for user ${id} by ${requester.id}`);
    return { message: 'Password reset successfully' };
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

  async deleteHard(id: string, requester?: User): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (requester && requester.id === id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.userRepository.manager.transaction(async (m) => {
      // 1) Detach references where this user acted on others' records.
      //    Keep the records but null out the staff/admin pointer.
      await m.query(
        `UPDATE tickets SET "staffId" = NULL WHERE "staffId" = $1`,
        [id],
      );
      await m.query(
        `UPDATE offer_tickets SET "staffId" = NULL WHERE "staffId" = $1 AND "userId" <> $1`,
        [id],
      );
      await m.query(
        `UPDATE subscription_usage_logs SET "staffId" = NULL
         WHERE "staffId" = $1
           AND "subscriptionPurchaseId" NOT IN (
             SELECT id FROM subscription_purchases WHERE "userId" = $1
           )`,
        [id],
      );
      await m.query(
        `UPDATE support_tickets SET "assignedTo" = NULL WHERE "assignedTo" = $1`,
        [id],
      );
      await m.query(
        `UPDATE school_trip_requests SET "approvedBy" = NULL WHERE "approvedBy" = $1`,
        [id],
      );
      await m.query(
        `UPDATE gift_orders SET "claimedByUserId" = NULL
         WHERE "claimedByUserId" = $1 AND "senderUserId" <> $1`,
        [id],
      );

      // 2) Delete payments tied to anything this user owns.
      await m.query(
        `DELETE FROM payments WHERE "bookingId" IN (SELECT id FROM bookings WHERE "userId" = $1)`,
        [id],
      );
      await m.query(
        `DELETE FROM payments WHERE "offerBookingId" IN (SELECT id FROM offer_bookings WHERE "userId" = $1)`,
        [id],
      );
      await m.query(
        `DELETE FROM payments WHERE "tripRequestId" IN (SELECT id FROM school_trip_requests WHERE "requesterId" = $1)`,
        [id],
      );
      await m.query(
        `DELETE FROM payments WHERE "eventRequestId" IN (SELECT id FROM event_requests WHERE "requesterId" = $1)`,
        [id],
      );
      await m.query(
        `DELETE FROM payments WHERE "subscriptionPurchaseId" IN (SELECT id FROM subscription_purchases WHERE "userId" = $1)`,
        [id],
      );
      await m.query(
        `DELETE FROM payments WHERE "giftOrderId" IN (SELECT id FROM gift_orders WHERE "senderUserId" = $1)`,
        [id],
      );

      // 3) Delete bookings and their dependents.
      await m.query(
        `DELETE FROM tickets WHERE "bookingId" IN (SELECT id FROM bookings WHERE "userId" = $1)`,
        [id],
      );
      await m.query(`DELETE FROM reviews WHERE "userId" = $1`, [id]);
      await m.query(`DELETE FROM bookings WHERE "userId" = $1`, [id]);

      // 4) Subscriptions, offers, trips, events, gifts owned by this user.
      await m.query(
        `DELETE FROM subscription_usage_logs WHERE "subscriptionPurchaseId" IN (SELECT id FROM subscription_purchases WHERE "userId" = $1)`,
        [id],
      );
      await m.query(`DELETE FROM offer_tickets WHERE "userId" = $1`, [id]);
      await m.query(`DELETE FROM offer_bookings WHERE "userId" = $1`, [id]);
      await m.query(
        `DELETE FROM subscription_purchases WHERE "userId" = $1`,
        [id],
      );
      await m.query(
        `DELETE FROM school_trip_requests WHERE "requesterId" = $1`,
        [id],
      );
      await m.query(`DELETE FROM event_requests WHERE "requesterId" = $1`, [
        id,
      ]);
      await m.query(`DELETE FROM gift_orders WHERE "senderUserId" = $1`, [id]);

      // 5) Support, favorites, referrals, notifications, devices.
      await m.query(`DELETE FROM support_tickets WHERE "userId" = $1`, [id]);
      await m.query(`DELETE FROM favorites WHERE "userId" = $1`, [id]);
      await m.query(
        `DELETE FROM referral_attributions WHERE "refereeId" = $1 OR "referrerId" = $1`,
        [id],
      );
      await m.query(
        `DELETE FROM referral_earnings WHERE "referrerId" = $1 OR "refereeId" = $1`,
        [id],
      );
      await m.query(`DELETE FROM referral_codes WHERE "userId" = $1`, [id]);
      await m.query(`DELETE FROM device_tokens WHERE "userId" = $1`, [id]);
      await m.query(`DELETE FROM notifications WHERE "userId" = $1`, [id]);

      // 6) Wallet + financial trail.
      await m.query(`DELETE FROM loyalty_transactions WHERE "userId" = $1`, [
        id,
      ]);
      await m.query(`DELETE FROM wallet_transactions WHERE "userId" = $1`, [
        id,
      ]);
      await m.query(`DELETE FROM wallets WHERE "userId" = $1`, [id]);

      // 7) Finally, the user.
      await m.query(`DELETE FROM users WHERE id = $1`, [id]);
    });

    this.logger.log(
      `User hard-deleted (cascade): ${id} by ${requester?.id || 'system'}`,
    );
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
        throw new ForbiddenException(
          'You can only delete staff from your own branch',
        );
      }

      // Branch managers can only delete staff users, not other roles
      if (!user.roles?.includes(UserRole.STAFF)) {
        throw new ForbiddenException('You can only delete staff members');
      }
    }

    if (
      (user.bookings && user.bookings.length > 0) ||
      (user.supportTickets && user.supportTickets.length > 0)
    ) {
      throw new BadRequestException(
        'User has related records; deactivate instead',
      );
    }

    const wallet = await this.walletRepository.findOne({
      where: { userId: id },
      relations: ['transactions'] as any,
    });
    if (
      wallet &&
      (wallet as any).transactions &&
      (wallet as any).transactions.length > 0
    ) {
      throw new BadRequestException(
        'User wallet has transactions; deactivate instead',
      );
    }

    if (wallet) {
      await this.walletRepository.delete(wallet.id);
    }

    await this.userRepository.delete(id);
    this.logger.log(`Staff deleted by ${requester.id}: ${id}`);
  }

  async deleteMyAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['bookings', 'supportTickets'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has active bookings or support tickets
    if (
      (user.bookings && user.bookings.length > 0) ||
      (user.supportTickets && user.supportTickets.length > 0)
    ) {
      throw new BadRequestException(
        'Cannot delete account with active bookings or support tickets. Please cancel bookings and close tickets first.',
      );
    }

    // Check if wallet has transactions
    const wallet = await this.walletRepository.findOne({
      where: { userId },
      relations: ['transactions'] as any,
    });

    if (
      wallet &&
      (wallet as any).transactions &&
      (wallet as any).transactions.length > 0
    ) {
      throw new BadRequestException(
        'Cannot delete account with wallet transactions. Please contact support.',
      );
    }

    // Delete wallet if exists
    if (wallet) {
      await this.walletRepository.delete(wallet.id);
    }

    // Delete user account
    await this.userRepository.delete(userId);
    this.logger.log(`User account deleted by user: ${userId}`);
  }
}
