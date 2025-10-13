import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { User } from '../../database/entities/user.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { EncryptionService } from '../../utils/encryption.util';
import { UserRole } from '../../common/decorators/roles.decorator';

@Injectable()
export class AdminSeeder implements OnModuleInit {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService.get<string>('ADMIN_EMAIL');
    const password = this.configService.get<string>('ADMIN_PASSWORD');
    const name =
      this.configService.get<string>('ADMIN_NAME') || 'Administrator';
    const phone = this.configService.get<string>('ADMIN_PHONE');
    const overwrite =
      this.configService.get<string>('ADMIN_OVERWRITE') === 'true';

    if (!email || !password) {
      this.logger.warn(
        'Admin seeder skipped: ADMIN_EMAIL or ADMIN_PASSWORD not set',
      );
      return; // Seeder disabled if not configured
    }

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      if (!overwrite) {
        this.logger.log(
          `Admin already exists: ${email} (set ADMIN_OVERWRITE=true to update)`,
        );
        return;
      }

      // Overwrite password and roles if requested
      const newHash = await bcrypt.hash(password, 12);
      existing.passwordHash = newHash;
      existing.roles = Array.from(
        new Set([...(existing.roles || []), UserRole.ADMIN]),
      );
      if (phone) {
        existing.phone = this.encryptionService.encrypt(phone);
      }
      existing.isActive = true;
      existing.name = name;
      existing.language = existing.language || 'ar';
      await this.userRepository.save(existing);
      this.logger.log(`Admin account updated: ${email}`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let admin = this.userRepository.create({
      email,
      name,
      passwordHash,
      roles: [UserRole.ADMIN],
      phone: phone ? this.encryptionService.encrypt(phone) : undefined,
      language: 'ar',
      isActive: true,
    });
    admin = await this.userRepository.save(admin);

    const wallet = this.walletRepository.create({
      userId: admin.id,
      balance: 0,
      loyaltyPoints: 0,
    });
    await this.walletRepository.save(wallet);

    this.logger.log(`Admin account created: ${email}`);
  }
}
