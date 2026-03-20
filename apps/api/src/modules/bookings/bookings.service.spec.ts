import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { BookingsService } from './bookings.service';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { User } from '../../database/entities/user.entity';
import { Offer } from '../../database/entities/offer.entity';
import { ContentService } from '../content/content.service';
import { CouponsService } from '../coupons/coupons.service';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('BookingsService', () => {
  it('stores resolved add-on name and price when create payload only provides id and quantity', async () => {
    const queryRunner = {
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      manager: {
        create: jest.fn((_: unknown, data: Partial<Booking>) => ({
          id: 'booking-1',
          ...data,
        })),
        save: jest.fn(async <T>(entity: T) => entity),
      },
    };

    const dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    } as unknown as DataSource;

    const redisService = {
      del: jest.fn(async () => undefined),
    } as Partial<RedisService>;

    const notifications = {
      enqueue: jest.fn(async () => undefined),
    } as Partial<NotificationsService>;

    const configService = {
      get: jest.fn(() => '60'),
    } as Partial<ConfigService>;

    const service = new BookingsService(
      {} as Repository<Booking>,
      {} as Repository<Ticket>,
      {} as Repository<User>,
      {} as Repository<Offer>,
      {} as ContentService,
      {} as CouponsService,
      {} as QRCodeService,
      redisService as RedisService,
      dataSource,
      notifications as NotificationsService,
      configService as ConfigService,
    );

    jest.spyOn(service, 'getQuote').mockResolvedValue({
      branchId: 'branch-1',
      branchName: 'Branch 1',
      pricing: {},
      addOns: [
        {
          id: 'addon-1',
          name: 'Decoration Package',
          price: 150,
          quantity: 2,
          total: 300,
        },
      ],
      discount: 0,
      totalPrice: 500,
      available: true,
    });

    const startDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startDate.setUTCMinutes(0, 0, 0);
    const startTime = startDate.toISOString();

    await service.createBooking('user-1', {
      branchId: 'branch-1',
      startTime,
      durationHours: 2,
      persons: 4,
      addOns: [
        {
          id: 'addon-1',
          quantity: 2,
        },
      ],
    });

    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      Booking,
      expect.objectContaining({
        status: BookingStatus.PENDING,
        addOns: [
          {
            id: 'addon-1',
            name: 'Decoration Package',
            price: 150,
            quantity: 2,
          },
        ],
      }),
    );
  });
});
