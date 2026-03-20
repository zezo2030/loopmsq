import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';

describe('CreateBookingDto', () => {
  it('allows add-ons with id and quantity only', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      branchId: '550e8400-e29b-41d4-a716-446655440000',
      startTime: '2026-03-15T10:00:00.000Z',
      durationHours: 2,
      persons: 4,
      addOns: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          quantity: 2,
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
