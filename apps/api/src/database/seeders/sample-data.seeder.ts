import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../entities/branch.entity';
import { Hall } from '../entities/hall.entity';

@Injectable()
export class SampleDataSeeder implements OnModuleInit {
  private readonly logger = new Logger(SampleDataSeeder.name);

  constructor(
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(Hall)
    private hallRepository: Repository<Hall>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
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

      // Create sample branch
      const branch = this.branchRepository.create({
        name_ar: 'الفرع الرئيسي',
        name_en: 'Main Branch',
        location: 'الرياض، المملكة العربية السعودية',
        capacity: 1000,
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
      });

      const savedBranch = await this.branchRepository.save(branch);
      this.logger.log(`Branch created: ${savedBranch.id}`);

      // Create sample halls
      const halls = [
        {
          name_ar: 'قاعة الاحتفالات الكبرى',
          name_en: 'Grand Celebration Hall',
          priceConfig: {
            basePrice: 500,
            hourlyRate: 200,
            weekendMultiplier: 1.5,
            holidayMultiplier: 2.0,
            decorationPrice: 300,
          },
          isDecorated: true,
          capacity: 100,
          status: 'available',
          description_ar: 'قاعة فسيحة ومجهزة بأحدث التقنيات للاحتفالات الكبرى',
          description_en: 'Spacious hall equipped with latest technology for grand celebrations',
          features: ['نظام صوت متطور', 'بروجكتر عالي الدقة', 'تكييف مركزي', 'منصة متحركة'],
          images: ['https://example.com/hall1.jpg', 'https://example.com/hall2.jpg'],
        },
        {
          name_ar: 'قاعة الاجتماعات',
          name_en: 'Meeting Hall',
          priceConfig: {
            basePrice: 300,
            hourlyRate: 150,
            weekendMultiplier: 1.3,
            holidayMultiplier: 1.8,
            decorationPrice: 200,
          },
          isDecorated: false,
          capacity: 50,
          status: 'available',
          description_ar: 'قاعة مناسبة للاجتماعات والعروض التقديمية',
          description_en: 'Suitable hall for meetings and presentations',
          features: ['شاشة عرض', 'سبورة ذكية', 'تكييف', 'إنترنت سريع'],
          images: ['https://example.com/meeting1.jpg'],
        },
        {
          name_ar: 'قاعة الأفراح',
          name_en: 'Wedding Hall',
          priceConfig: {
            basePrice: 800,
            hourlyRate: 300,
            weekendMultiplier: 1.8,
            holidayMultiplier: 2.5,
            decorationPrice: 500,
          },
          isDecorated: true,
          capacity: 200,
          status: 'available',
          description_ar: 'قاعة مخصصة للأفراح والمناسبات الخاصة',
          description_en: 'Dedicated hall for weddings and special occasions',
          features: ['ديكور فاخر', 'إضاءة متطورة', 'نظام صوت احترافي', 'مسرح'],
          images: ['https://example.com/wedding1.jpg', 'https://example.com/wedding2.jpg'],
        },
      ];

      for (const hallData of halls) {
        const hall = this.hallRepository.create({
          ...hallData,
          branchId: savedBranch.id,
        });

        const savedHall = await this.hallRepository.save(hall);
        this.logger.log(`Hall created: ${savedHall.id} - ${savedHall.name_en}`);
      }

      this.logger.log('Sample data seeding completed successfully!');
    } catch (error) {
      this.logger.error('Error seeding sample data:', error);
      throw error;
    }
  }
}
