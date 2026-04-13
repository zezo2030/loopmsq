export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  if (cleaned.startsWith('5') && cleaned.length >= 9) {
    cleaned = '+966' + cleaned;
  }

  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, '');

  if (digits.length < 10) {
    return normalized;
  }

  const countryCode = digits.slice(0, 3);
  const firstTwo = digits.slice(3, 5);
  const lastTwo = digits.slice(-2);
  const middleLength = digits.length - 7;

  const masked = 'X'.repeat(Math.max(middleLength, 3));

  return `+${countryCode} ${firstTwo}${masked.charAt(0)} ${masked.slice(1)} ${lastTwo.charAt(0)}${lastTwo.charAt(lastTwo.length - 1)}`;
}

export function phonesMatch(a: string, b: string): boolean {
  try {
    return normalizePhone(a) === normalizePhone(b);
  } catch {
    return false;
  }
}
