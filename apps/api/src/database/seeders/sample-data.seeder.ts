import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Branch } from '../entities/branch.entity';

@Injectable()
export class SampleDataSeeder implements OnModuleInit {
  private readonly logger = new Logger(SampleDataSeeder.name);

  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    private configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      // Check if seeding is disabled via environment variable
      const isSeedingEnabled =
        this.configService.get<string>('SEED_DATA') !== 'false';

      if (!isSeedingEnabled) {
        this.logger.log('Sample data seeding is disabled (SEED_DATA=false)');
        return;
      }

      await this.seedSampleData();
    } catch (error) {
      this.logger.error('Failed to seed sample data:', error);
      // Don't throw error to prevent app startup failure
    }
  }

  async seedSampleData(): Promise<void> {
    try {
      // Check if data already exists
      const existingBranches = await this.branchRepository.count();
      if (existingBranches > 0) {
        this.logger.log('Sample data already exists, skipping seeding');
        return;
      }

      this.logger.log('Starting to seed sample data...');

      // Create sample branch with hall data (merged into branch)
      const branch = this.branchRepository.create({
        name_ar: 'الفرع الرئيسي',
        name_en: 'Main Branch',
        location: 'الرياض، المملكة العربية السعودية',
        status: 'active',
        description_ar: 'الفرع الرئيسي للمنشأة في قلب الرياض',
        description_en: 'Main branch of the facility in the heart of Riyadh',
        contactPhone: '+966501234567',
        workingHours: {
          sunday: { open: '08:00', close: '22:00' },
          monday: { open: '08:00', close: '22:00' },
          tuesday: { open: '08:00', close: '22:00' },
          wednesday: { open: '08:00', close: '22:00' },
          thursday: { open: '08:00', close: '22:00' },
          friday: { open: '14:00', close: '22:00' },
          saturday: { open: '08:00', close: '22:00' },
        },
        amenities: ['مواقف سيارات', 'مطعم', 'صالة انتظار', 'واي فاي مجاني'],
        isDecorated: true,
        hallFeatures: [
          'نظام صوت متطور',
          'بروجكتر عالي الدقة',
          'تكييف مركزي',
          'منصة متحركة',
        ],
        hallImages: [
          'https://example.com/hall1.jpg',
          'https://example.com/hall2.jpg',
        ],
        hallStatus: 'available',
      });

      const savedBranch = await this.branchRepository.save(branch);
      this.logger.log(`Branch created with hall data: ${savedBranch.id}`);

      this.logger.log('Sample data seeding completed successfully!');
    } catch (error) {
      this.logger.error('Error seeding sample data:', error);
      throw error;
    }
  }
}
