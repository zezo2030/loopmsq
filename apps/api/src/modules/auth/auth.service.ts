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
    const email = sendOtpDto.email.toLowerCase();

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
    const rateLimitKey = `otp_rate:${email}`;
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

    // Store OTP in Redis with 5 minutes expiry
    await this.redisService.setOTP(
      email,
      otp,
      Number(otpCfg.expirySeconds) || 300,
    );

    // Enqueue Email OTP
    await this.notifications.enqueue({
      type: 'OTP',
      to: { email: email },
      data: { otp },
      lang,
      channels: ['email'],
    });

    const message =
      language === 'ar'
        ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
        : 'OTP sent to your email';

    return {
      success: true,
      message,
    };
  }

  async registerSendOtp(
    dto: RegisterSendOtpDto,
  ): Promise<{ success: boolean; message: string }> {
    const name = (dto.name || '').trim();
    const email = (dto.email || '').trim().toLowerCase();
    const language = dto.language ?? 'ar';
    const normalizedPhone = dto.phone ? this.normalizePhone(dto.phone) : null;

    if (!name) {
      throw new BadRequestException('Name is required');
    }

    // Ensure email not used
    const existingByEmail = await this.userRepository.findOne({
      where: { email },
    });
    if (existingByEmail) {
      throw new ConflictException('Email already exists');
    }

    // Ensure phone not used only if phone is provided (using decrypt-compare)
    if (normalizedPhone) {
      const existingByPhone =
        await this.findUserByDecryptedPhone(normalizedPhone);
      if (existingByPhone) {
        throw new ConflictException('Phone number already exists');
      }
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

    // Rate limiting check (configurable)
    const rateLimitKey = `otp_register_rate:${email}`;
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

    // Store OTP and pending registration data (password hashed)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.redisService.setOTP(
      email,
      otp,
      Number(otpCfg.expirySeconds) || 300,
    ); // OTP expiry
    await this.redisService.set(
      `reg:${email}`,
      {
        name,
        email,
        phone: normalizedPhone,
        passwordHash,
        language,
      },
      900,
    ); // 15 minutes for registration data

    // Enqueue Email OTP for registration
    await this.notifications.enqueue({
      type: 'OTP',
      to: { email: email },
      data: { otp },
      lang: language as 'ar' | 'en',
      channels: ['email'],
    });

    const message =
      language === 'ar'
        ? 'تم إرسال رمز التحقق للتسجيل'
        : 'Registration OTP sent';

    return { success: true, message };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
    isNewUser: boolean;
  }> {
    const name = verifyOtpDto.name;
    const email = verifyOtpDto.email.toLowerCase();
    const normalizedOtp = this.normalizeOtp(verifyOtpDto.otp);

    // Verify OTP
    let storedOtp: string | null = null;
    try {
      storedOtp = await this.redisService.getOTP(email);
    } catch (e) {
      this.logger.error(
        `Redis error while fetching OTP for ${email}: ${String(e)}`,
      );
      throw new BadRequestException(
        'OTP service temporarily unavailable, please try again',
      );
    }
    if (!storedOtp || storedOtp !== normalizedOtp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Delete OTP after successful verification
    try {
      await this.redisService.deleteOTP(email);
    } catch (e) {
      this.logger.warn(
        `Failed to delete OTP for ${email}: ${String(e)}`,
      );
    }

    // Find or create user
    let user = await this.userRepository.findOne({
      where: { email },
    });
    let isNewUser = false;

    if (!user) {
      if (!name) {
        throw new BadRequestException('Name is required for new users');
      }

      // Create new user
      user = this.userRepository.create({
        email,
        name,
        roles: [UserRole.USER],
        isActive: true,
        lastLoginAt: new Date(),
      });

      user = await this.userRepository.save(user);

      // Create wallet for new user
      const wallet = this.walletRepository.create({
        userId: user.id,
        balance: 0,
        loyaltyPoints: 0,
      });
      await this.walletRepository.save(wallet);

      isNewUser = true;
      this.logger.log(`New user registered: ${user.id}`);
    } else {
      // Update last login
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: email,
        name: user.name,
        roles: user.roles,
        language: user.language,
      },
      isNewUser,
    };
  }

  async registerVerifyOtp(dto: RegisterVerifyOtpDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
  }> {
    const email = dto.email.toLowerCase();
    const normalizedOtp = this.normalizeOtp(dto.otp);

    // Verify OTP
    let storedOtp: string | null = null;
    try {
      storedOtp = await this.redisService.getOTP(email);
    } catch (e) {
      this.logger.error(
        `Redis error while fetching OTP for ${email}: ${String(e)}`,
      );
      throw new BadRequestException(
        'OTP service temporarily unavailable, please try again',
      );
    }
    if (!storedOtp || storedOtp !== normalizedOtp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Delete OTP after successful verification
    try {
      await this.redisService.deleteOTP(email);
    } catch (e) {
      this.logger.warn(
        `Failed to delete OTP for ${email}: ${String(e)}`,
      );
    }

    // Load pending registration data
    const pending = (await this.redisService.get(`reg:${email}`)) as {
      name: string;
      email: string;
      phone?: string;
      passwordHash: string;
      language?: string;
    } | null;
    if (!pending) {
      throw new BadRequestException(
        'Registration data expired. Please restart registration.',
      );
    }

    const { name, email: pendingEmail, phone, passwordHash, language } = pending;

    // Final duplicate checks
    const existingByEmail = await this.userRepository.findOne({
      where: { email: pendingEmail },
    });
    if (existingByEmail) {
      throw new ConflictException('Email already exists');
    }
    
    // Check phone only if provided
    if (phone) {
      const existingByPhone =
        await this.findUserByDecryptedPhone(phone);
      if (existingByPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    // Create user
    let user = this.userRepository.create({
      email: pendingEmail,
      name,
      passwordHash,
      phone: phone ? this.encryptionService.encrypt(phone) : undefined,
      roles: [UserRole.USER],
      language: language ?? 'ar',
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

    // Clean pending registration data
    try {
      await this.redisService.del(`reg:${email}`);
    } catch (e) {
      this.logger.warn(
        `Failed to delete registration cache for ${email}: ${String(
          e,
        )}`,
      );
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone ? this.encryptionService.decrypt(user.phone) : undefined,
        name: user.name,
        roles: user.roles,
        language: user.language,
      },
    };
  }

  async staffLogin(staffLoginDto: StaffLoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
  }> {
    const { email, password } = staffLoginDto;

    // Find staff user
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

    // Allow only ADMIN or BRANCH_MANAGER to access the web dashboard
    if (
      !user.roles.includes(UserRole.ADMIN) &&
      !user.roles.includes(UserRole.BRANCH_MANAGER)
    ) {
      throw new UnauthorizedException('auth.access_denied');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
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
    const identifier = (dto.identifier || '').trim().toLowerCase();
    const isEmail = identifier.includes('@');

    let user: User | null = null;
    let decryptedPhone: string | undefined;

    if (isEmail) {
      user = await this.userRepository.findOne({
        where: { email: identifier, isActive: true },
      });
      if (user?.phone) {
        try {
          decryptedPhone = this.encryptionService.decrypt(user.phone);
        } catch {
          // ignore decryption errors
        }
      }
    } else {
      const normalizedPhone = this.normalizePhone(identifier);
      user = await this.findUserByDecryptedPhone(normalizedPhone);
      if (user && user.isActive === true) {
        decryptedPhone = normalizedPhone;
      }
    }

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

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
