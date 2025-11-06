import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { RedisService } from '../../utils/redis.service';
import { EncryptionService } from '../../utils/encryption.util';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { StaffLoginDto } from './dto/staff-login.dto';
import { UserRole } from '../../common/decorators/roles.decorator';
import { RegisterSendOtpDto } from './dto/register-send-otp.dto';
import { RegisterVerifyOtpDto } from './dto/register-verify-otp.dto';
import { UserLoginDto } from './dto/user-login.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private encryptionService: EncryptionService,
    private notifications: NotificationsService,
  ) {}

  async sendOtp(
    sendOtpDto: SendOtpDto,
  ): Promise<{ success: boolean; message: string }> {
    const language = sendOtpDto.language ?? 'ar';
    const lang: 'ar' | 'en' = language === 'en' ? 'en' : 'ar';
    const normalizedPhone = this.normalizePhone(sendOtpDto.phone);

    // Read OTP config from Redis
    const otpCfg = ((await this.redisService.get('config:otp')) as any) || {
      enabled: true,
      length: 6,
      expirySeconds: 300,
      rateTtlSeconds: 300,
      rateMaxAttempts: 3,
    };
    if (otpCfg.enabled === false) {
      throw new BadRequestException('OTP is disabled by configuration');
    }

    // Rate limiting check (configurable)
    const rateLimitKey = `otp_rate_phone:${normalizedPhone}`;
    const attempts = await this.redisService.incrementRateLimit(
      rateLimitKey,
      Number(otpCfg.rateTtlSeconds) || 300,
    );

    if (attempts > 3) {
      throw new BadRequestException(
        'Too many OTP requests. Please try again later.',
      );
    }

    // Generate OTP
    const otp = this.generateOtp(otpCfg.length || 6);

    // Log OTP to console for development/testing
    this.logger.log(
      `📱 [OTP] Phone: ${normalizedPhone} | OTP Code: ${otp}`,
    );
    console.log(
      `\n🔐 ========================================\n📱 OTP Code for ${normalizedPhone}\n🔑 Code: ${otp}\n⏰ Expires in: ${otpCfg.expirySeconds || 300} seconds\n========================================\n`,
    );

    // Store OTP in Redis with expiry using phone as key
    await this.redisService.setOTP(
      normalizedPhone,
      otp,
      Number(otpCfg.expirySeconds) || 300,
    );

    // Enqueue SMS OTP
    await this.notifications.enqueue({
      type: 'OTP',
      to: { phone: normalizedPhone },
      data: { otp },
      lang,
      channels: ['sms'],
    });

    const message =
      language === 'ar'
        ? 'تم إرسال رمز التحقق عبر الرسائل النصية'
        : 'OTP sent via SMS';

    return {
      success: true,
      message,
    };
  }

  async registerSendOtp(
    dto: RegisterSendOtpDto,
  ): Promise<{ success: boolean; message: string }> {
    const language = dto.language ?? 'ar';
    const normalizedPhone = this.normalizePhone(dto.phone);

    // Ensure phone not used
    const existingUser = await this.findUserByDecryptedPhone(normalizedPhone);
    if (existingUser) {
      throw new ConflictException('Phone number already exists');
    }

    // Read OTP config from Redis
    const otpCfg = ((await this.redisService.get('config:otp')) as any) || {
      enabled: true,
      length: 6,
      expirySeconds: 300,
      rateTtlSeconds: 300,
      rateMaxAttempts: 3,
    };
    if (otpCfg.enabled === false) {
      throw new BadRequestException('OTP is disabled by configuration');
    }

    // Rate limiting check using phone
    const rateLimitKey = `otp_register_rate_phone:${normalizedPhone}`;
    const attempts = await this.redisService.incrementRateLimit(
      rateLimitKey,
      Number(otpCfg.rateTtlSeconds) || 300,
    );
    if (attempts > Number(otpCfg.rateMaxAttempts || 3)) {
      throw new BadRequestException(
        'Too many OTP requests. Please try again later.',
      );
    }

    // Generate OTP
    const otp = this.generateOtp(otpCfg.length || 6);

    // Log OTP to console for development/testing
    this.logger.log(
      `📱 [REGISTER OTP] Phone: ${normalizedPhone} | OTP Code: ${otp}`,
    );
    console.log(
      `\n🔐 ========================================\n📱 REGISTRATION OTP Code for ${normalizedPhone}\n🔑 Code: ${otp}\n⏰ Expires in: ${otpCfg.expirySeconds || 300} seconds\n========================================\n`,
    );

    // Store OTP in Redis using phone as key
    await this.redisService.setOTP(
      normalizedPhone,
      otp,
      Number(otpCfg.expirySeconds) || 300,
    );

    // Enqueue SMS OTP for registration
    await this.notifications.enqueue({
      type: 'OTP',
      to: { phone: normalizedPhone },
      data: { otp },
      lang: language as 'ar' | 'en',
      channels: ['sms'],
    });

    const message =
      language === 'ar'
        ? 'تم إرسال رمز التحقق للتسجيل عبر الرسائل النصية'
        : 'Registration OTP sent via SMS';

    return { success: true, message };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
    isNewUser: boolean;
  }> {
    const normalizedPhone = this.normalizePhone(verifyOtpDto.phone);
    const normalizedOtp = this.normalizeOtp(verifyOtpDto.otp);

    // Verify OTP
    let storedOtp: string | null = null;
    try {
      storedOtp = await this.redisService.getOTP(normalizedPhone);
    } catch (e) {
      this.logger.error(
        `Redis error while fetching OTP for ${normalizedPhone}: ${String(e)}`,
      );
      throw new BadRequestException(
        'OTP service temporarily unavailable, please try again',
      );
    }
    if (!storedOtp || storedOtp !== normalizedOtp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Find user by phone
    const user = await this.findUserByDecryptedPhone(normalizedPhone);
    const isNewUser = !user;

    if (user) {
      // Existing user - login directly
      // Delete OTP after successful verification
      try {
        await this.redisService.deleteOTP(normalizedPhone);
      } catch (e) {
        this.logger.warn(
          `Failed to delete OTP for ${normalizedPhone}: ${String(e)}`,
        );
      }

      // Update last login
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      let decryptedPhone: string | undefined;
      if (user.phone) {
        try {
          decryptedPhone = this.encryptionService.decrypt(user.phone);
        } catch {
          // ignore decryption errors
        }
      }

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          phone: decryptedPhone,
          name: user.name,
          roles: user.roles,
          language: user.language,
        },
        isNewUser: false,
      };
    } else {
      // New user - don't create account yet, just mark as verified
      // Keep OTP in Redis for next step (completeRegistration)
      // Store phone temporarily for completion step
      try {
        await this.redisService.set(
          `reg_verified:${normalizedPhone}`,
          { phone: normalizedPhone },
          900, // 15 minutes
        );
      } catch (e) {
        this.logger.warn(
          `Failed to store verified phone for ${normalizedPhone}: ${String(e)}`,
        );
      }

      return {
        accessToken: '',
        refreshToken: '',
        user: {},
        isNewUser: true,
      };
    }
  }

  async registerVerifyOtp(dto: RegisterVerifyOtpDto): Promise<{
    requiresCompletion: boolean;
    message: string;
  }> {
    const normalizedPhone = this.normalizePhone(dto.phone);
    const normalizedOtp = this.normalizeOtp(dto.otp);

    // Verify OTP
    let storedOtp: string | null = null;
    try {
      storedOtp = await this.redisService.getOTP(normalizedPhone);
    } catch (e) {
      this.logger.error(
        `Redis error while fetching OTP for ${normalizedPhone}: ${String(e)}`,
      );
      throw new BadRequestException(
        'OTP service temporarily unavailable, please try again',
      );
    }
    if (!storedOtp || storedOtp !== normalizedOtp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Check if user already exists
    const existingUser = await this.findUserByDecryptedPhone(normalizedPhone);
    if (existingUser) {
      throw new ConflictException(
        'Phone number already registered. Please use login instead.',
      );
    }

    // Store verified phone for completion step
    try {
      await this.redisService.set(
        `reg_verified:${normalizedPhone}`,
        { phone: normalizedPhone },
        900, // 15 minutes
      );
    } catch (e) {
      this.logger.warn(
        `Failed to store verified phone for ${normalizedPhone}: ${String(e)}`,
      );
    }

    // Don't delete OTP yet - will be deleted in completeRegistration

    return {
      requiresCompletion: true,
      message: 'OTP verified. Please complete registration.',
    };
  }

  async staffLogin(staffLoginDto: StaffLoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
  }> {
    const { email, password } = staffLoginDto;

    // Find staff user by email
    const user = await this.userRepository.findOne({
      where: {
        email,
        isActive: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('auth.invalid_credentials');
    }

    // Allow only ADMIN, BRANCH_MANAGER, or STAFF to access the staff app
    if (
      !user.roles.includes(UserRole.ADMIN) &&
      !user.roles.includes(UserRole.BRANCH_MANAGER) &&
      !user.roles.includes(UserRole.STAFF)
    ) {
      throw new UnauthorizedException('auth.access_denied');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Decrypt phone for response if available
    let decryptedPhone: string | undefined;
    if (user.phone) {
      try {
        decryptedPhone = this.encryptionService.decrypt(user.phone);
      } catch {
        // ignore decryption errors
      }
    }

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        phone: decryptedPhone,
        name: user.name,
        roles: user.roles,
        language: user.language,
        branchId: user.branchId,
      },
    };
  }

  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['wallet'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
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
      branchId: user.branchId,
      createdAt: user.createdAt,
    };
  }

  async updateLanguage(userId: string, language: string): Promise<{ message: string }> {
    // Validate language
    if (!language || !['ar', 'en'].includes(language)) {
      throw new BadRequestException('Invalid language. Must be "ar" or "en"');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    user.language = language;
    await this.userRepository.save(user);

    return {
      message: language === 'ar' 
        ? 'تم تحديث اللغة بنجاح' 
        : 'Language updated successfully'
    };
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub, isActive: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async userLogin(dto: UserLoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
  }> {
    const normalizedPhone = this.normalizePhone(dto.phone);

    // Find user by phone
    const user = await this.findUserByDecryptedPhone(normalizedPhone);

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Decrypt phone for response
    let decryptedPhone: string | undefined;
    if (user.phone) {
      try {
        decryptedPhone = this.encryptionService.decrypt(user.phone);
      } catch {
        // ignore decryption errors
      }
    }

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        phone: decryptedPhone,
        name: user.name,
        roles: user.roles,
        language: user.language,
      },
    };
  }

  async completeRegistration(dto: CompleteRegistrationDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
  }> {
    const normalizedPhone = this.normalizePhone(dto.phone);
    const language = dto.language ?? 'ar';

    // Verify that phone was verified in previous step
    const verified = (await this.redisService.get(
      `reg_verified:${normalizedPhone}`,
    )) as { phone: string } | null;
    if (!verified) {
      throw new BadRequestException(
        'Phone verification expired. Please restart registration.',
      );
    }

    // Check if user already exists
    const existingUser = await this.findUserByDecryptedPhone(normalizedPhone);
    if (existingUser) {
      throw new ConflictException('Phone number already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user (without email)
    let user = this.userRepository.create({
      phone: this.encryptionService.encrypt(normalizedPhone),
      name: dto.name.trim(),
      passwordHash,
      roles: [UserRole.USER],
      language,
      isActive: true,
      lastLoginAt: new Date(),
    });
    user = await this.userRepository.save(user);

    // Create wallet
    const wallet = this.walletRepository.create({
      userId: user.id,
      balance: 0,
      loyaltyPoints: 0,
    });
    await this.walletRepository.save(wallet);

    // Clean up Redis data
    try {
      await this.redisService.del(`reg_verified:${normalizedPhone}`);
      await this.redisService.deleteOTP(normalizedPhone);
    } catch (e) {
      this.logger.warn(
        `Failed to clean up registration data for ${normalizedPhone}: ${String(
          e,
        )}`,
      );
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    this.logger.log(`New user registered: ${user.id}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: normalizedPhone,
        name: user.name,
        roles: user.roles,
        language: user.language,
      },
    };
  }

  private generateOtp(length: number = 6): string {
    const l = Math.min(Math.max(length, 4), 8);
    const min = Math.pow(10, l - 1);
    const max = Math.pow(10, l) - 1;
    return Math.floor(min + Math.random() * (max - min)).toString();
  }

  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = {
      sub: user.id,
      roles: user.roles,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '4h',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'default-refresh-secret',
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private normalizePhone(input: string): string {
    if (!input) return input;
    const trimmed = input.trim();
    const asciiDigits = this.toAsciiDigits(trimmed);
    return asciiDigits.replace(/[\s\-()]/g, '');
  }

  private normalizeOtp(input: string): string {
    if (!input) return input;
    const asciiDigits = this.toAsciiDigits(input.trim());
    return asciiDigits;
  }

  private toAsciiDigits(input: string): string {
    // Convert Arabic-Indic and Eastern Arabic-Indic digits to ASCII 0-9
    return input
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  }

  private async findUserByDecryptedPhone(
    plainPhone: string,
  ): Promise<User | null> {
    const candidates = await this.userRepository.find({
      where: { phone: Not(IsNull()) },
    });
    for (const candidate of candidates) {
      try {
        if (candidate.phone) {
          const decrypted = this.encryptionService.decrypt(candidate.phone);
          if (decrypted && this.normalizePhone(decrypted) === plainPhone) {
            return candidate;
          }
        }
      } catch {
        // skip invalid decryption
      }
    }
    return null;
  }

  private getPhoneKeyVariants(normalized: string): string[] {
    const variants = new Set<string>();
    variants.add(normalized);
    // Without leading plus
    if (normalized.startsWith('+')) {
      variants.add(normalized.substring(1));
      // Convert + to 00
      variants.add(`00${normalized.substring(1)}`);
    }
    // Convert leading 00 to +
    if (normalized.startsWith('00')) {
      variants.add(`+${normalized.substring(2)}`);
    }
    return Array.from(variants);
  }
}
