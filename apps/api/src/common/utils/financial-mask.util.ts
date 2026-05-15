import { User } from '../../database/entities/user.entity';
import { UserRole } from '../decorators/roles.decorator';

const AMOUNT_KEYS = new Set<string>([
  'totalAmount',
  'totalPrice',
  'discountAmount',
  'subtotal',
  'addonsTotal',
  'amount',
  'quotedPrice',
  'revenue',
  'price',
  'depositAmount',
  'amountPaid',
  'remainingAmount',
  'ticketsSubtotal',
  'addonsSubtotal',
  'ticketPricePerStudent',
  'hallRentalPrice',
  'addOnsSubtotal',
  'refundedAmount',
]);

export function canViewBookingAmounts(
  user: User | undefined | null,
): boolean {
  if (!user) return true;
  if (user.roles?.includes(UserRole.ADMIN)) return true;
  if (user.roles?.includes(UserRole.BRANCH_MANAGER)) {
    return user.permissions?.canViewBookingAmounts ?? true;
  }
  return true;
}

export function maskAmounts<T>(data: T, user: User | undefined | null): T {
  if (canViewBookingAmounts(user)) return data;
  return walk(data, new WeakSet()) as T;
}

function walk(value: any, seen: WeakSet<object>): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => walk(v, seen));
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  const out: Record<string, any> = { ...value };
  for (const key of Object.keys(out)) {
    if (AMOUNT_KEYS.has(key)) {
      const v = out[key];
      if (typeof v === 'number' || typeof v === 'string') {
        out[key] = null;
      }
    } else if (typeof out[key] === 'object' && out[key] !== null) {
      out[key] = walk(out[key], seen);
    }
  }
  return out;
}
