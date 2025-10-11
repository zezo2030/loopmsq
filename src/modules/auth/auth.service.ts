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
  ) {}

  async sendOtp(sendOtpDto: SendOtpDto): Promise<{ success: boolean; message: string }> {
    const language = sendOtpDto.language ?? 'ar';
    const normalizedPhone = this.normalizePhone(sendOtpDto.phone);

    // Rate limiting check
    const rateLimitKey = `otp_rate:${normalizedPhone}`;
    const attempts = await this.redisService.incrementRateLimit(rateLimitKey, 300); // 5 minutes
    
    if (attempts > 3) {
      throw new BadRequestException('Too many OTP requests. Please try again later.');
    }

    // Generate OTP
    const otp = this.generateOtp();
    
    // Store OTP in Redis with 5 minutes expiry
    await this.redisService.setOTP(normalizedPhone, otp, 300);

    // TODO: Send SMS via Twilio or other SMS provider
    this.logger.log(`OTP for ${normalizedPhone}: ${otp}`); // For development only

    const message = language === 'ar' 
      ? 'تم إرسال رمز التحقق إلى هاتفك'
      : 'OTP sent to your phone';

    return {
      success: true,
      message,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
    isNewUser: boolean;
  }> {
    const name = verifyOtpDto.name;
    const normalizedPhone = this.normalizePhone(verifyOtpDto.phone);
    const normalizedOtp = this.normalizeOtp(verifyOtpDto.otp);

    // Verify OTP
    let storedOtp: string | null = null;
    let otpKeyUsed: string | null = null;
    try {
      // Try multiple key variants for backward compatibility
      const phoneKeyCandidates = this.getPhoneKeyVariants(normalizedPhone);
      for (const candidate of phoneKeyCandidates) {
        const candidateOtp = await this.redisService.getOTP(candidate);
        if (candidateOtp) {
          storedOtp = candidateOtp;
          otpKeyUsed = candidate;
          break;
        }
      }
    } catch (e) {
      this.logger.error(`Redis error while fetching OTP for ${normalizedPhone}: ${String(e)}`);
      throw new BadRequestException('OTP service temporarily unavailable, please try again');
    }
    if (!storedOtp || storedOtp !== normalizedOtp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Delete OTP after successful verification
    try {
      await this.redisService.deleteOTP(otpKeyUsed ?? normalizedPhone);
    } catch (e) {
      this.logger.warn(`Failed to delete OTP for ${normalizedPhone}: ${String(e)}`);
    }

    // Find or create user
    let user = await this.findUserByDecryptedPhone(normalizedPhone);
    let isNewUser = false;

    if (!user) {
      if (!name) {
        throw new BadRequestException('Name is required for new users');
      }

      // Create new user
      user = this.userRepository.create({
        phone: this.encryptionService.encrypt(normalizedPhone),
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
        phone: normalizedPhone, // Return decrypted phone
        name: user.name,
        roles: user.roles,
        language: user.language,
      },
      isNewUser,
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
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has staff or admin role
    if (!user.roles.includes(UserRole.STAFF) && !user.roles.includes(UserRole.ADMIN)) {
      throw new UnauthorizedException('Access denied');
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
      phone: user.phone ? this.encryptionService.decrypt(user.phone) : undefined,
      email: user.email,
      name: user.name,
      roles: user.roles,
      language: user.language,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub, isActive: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = {
      sub: user.id,
      phone: user.phone,
      roles: user.roles,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '24h',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'default-refresh-secret',
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

  private async findUserByDecryptedPhone(plainPhone: string): Promise<User | null> {
    const candidates = await this.userRepository.find({ where: { phone: Not(IsNull()) } });
    for (const candidate of candidates) {
      try {
        const decrypted = this.encryptionService.decrypt(candidate.phone);
        if (decrypted && this.normalizePhone(decrypted) === plainPhone) {
          return candidate;
        }
      } catch (e) {
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
