import { ConfigService } from '@nestjs/config';

export const getBookingSlotMinutes = (configService: ConfigService): number => {
  const configured = Number.parseInt(
    configService.get<string>('BOOKING_SLOT_MINUTES') ?? '',
    10,
  );

  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return 60;
};

