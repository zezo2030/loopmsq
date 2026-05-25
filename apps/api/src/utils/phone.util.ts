const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EXT_DIGITS = '0123456789';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toAsciiDigits(input: string): string {
  return input.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (char) => {
    let index = ARABIC_DIGITS.indexOf(char);
    if (index >= 0) return EXT_DIGITS[index];
    index = PERSIAN_DIGITS.indexOf(char);
    if (index >= 0) return EXT_DIGITS[index];
    return char;
  });
}

/** Extract 9-digit Saudi mobile local part (5XXXXXXXX) or return null. */
export function extractSaudiMobileDigits(phone: string): string | null {
  if (!phone?.trim()) return null;

  let cleaned = toAsciiDigits(phone.trim()).replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('+966')) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith('00966')) cleaned = cleaned.slice(5);
  else if (cleaned.startsWith('966')) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
  else if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);

  if (/^5\d{8}$/.test(cleaned)) return cleaned;
  return null;
}

export function toSaudiE164(phone: string): string | null {
  const digits = extractSaudiMobileDigits(phone);
  return digits ? `+966${digits}` : null;
}

export function isValidSaudiPhone(phone: string): boolean {
  return toSaudiE164(phone) !== null;
}

export function normalizePhone(phone: string): string {
  const saudi = toSaudiE164(phone);
  if (saudi) return saudi;

  let cleaned = toAsciiDigits(phone).replace(/[\s\-()]/g, '');

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
