const RIYADH_TZ_OFFSET_MINUTES = 3 * 60;

const HOUR_MS = 60 * 60 * 1000;

function extractCalendarDateParts(input: Date | string): {
  year: number;
  month: number;
  day: number;
} {
  if (typeof input === 'string') {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }

  const parsed = input instanceof Date ? input : new Date(input);
  const shifted = new Date(
    parsed.getTime() + RIYADH_TZ_OFFSET_MINUTES * 60 * 1000,
  );

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function resolveEventTicketWindow(
  input: Date | string,
  durationHours: number,
): {
  anchorStart: Date;
  validFrom: Date;
  validUntil: Date;
} {
  const { year, month, day } = extractCalendarDateParts(input);
  const anchorStartUtcMs =
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) -
    RIYADH_TZ_OFFSET_MINUTES * 60 * 1000;

  const anchorStart = new Date(anchorStartUtcMs);
  const safeDurationHours = Number.isFinite(durationHours)
    ? Math.max(1, Math.floor(durationHours))
    : 1;

  return {
    anchorStart,
    validFrom: anchorStart,
    validUntil: new Date(anchorStartUtcMs + safeDurationHours * HOUR_MS),
  };
}
