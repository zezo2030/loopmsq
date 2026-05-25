import type { Rule } from 'antd/es/form';
import type { TFunction } from 'i18next';

const SAUDI_MOBILE_PATTERN = /^5\d{8}$/;

export function isValidSaudiMobileDigits(value: string): boolean {
  return SAUDI_MOBILE_PATTERN.test(value.replace(/\D/g, ''));
}

export function buildSaudiPhone(nineDigits: string): string {
  const digits = nineDigits.replace(/\D/g, '');
  return `+966${digits}`;
}

export function saudiPhoneFormRules(t: TFunction, required = false): Rule[] {
  const rules: Rule[] = [];

  if (required) {
    rules.push({
      required: true,
      message: t('staff.phone_required') || 'أدخل رقم الهاتف',
    });
  }

  rules.push({
    validator: (_: unknown, value: string) => {
      if (!value?.trim()) return Promise.resolve();
      if (isValidSaudiMobileDigits(value)) return Promise.resolve();
      return Promise.reject(
        new Error(
          t('staff.phone_invalid') ||
            'أدخل 9 أرقام سعودية تبدأ بـ 5 (مثال: 501234567)',
        ),
      );
    },
  });

  return rules;
}

const API_ERROR_KEYS: Record<string, string> = {
  'Email already exists': 'errors.email_exists',
  'Phone number already exists': 'errors.phone_exists',
  'Email or phone already exists': 'errors.email_or_phone_exists',
  'Invalid Saudi phone number. Enter 9 digits starting with 5':
    'errors.phone_invalid_saudi',
  'Cannot reset admin password': 'errors.cannot_reset_admin_password',
  'Password reset is only available for staff and branch managers':
    'errors.password_reset_staff_only',
  'You can only reset passwords for staff in your branch':
    'errors.password_reset_branch_only',
  'You can only reset passwords for staff members':
    'errors.password_reset_staff_members_only',
};

export function parseApiErrorMessage(error: unknown, t?: TFunction): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');

  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message
        .map((item) => translateApiError(item, t))
        .join(' — ');
    }
    if (typeof parsed.message === 'string') {
      return translateApiError(parsed.message, t);
    }
  } catch {
    // not JSON — fall through
  }

  return (
    translateApiError(raw, t) ||
    t?.('errors.request_failed') ||
    'حدث خطأ'
  );
}

function translateApiError(message: string, t?: TFunction): string {
  const key = API_ERROR_KEYS[message];
  if (key && t) {
    return t(key) || message;
  }
  return message;
}
