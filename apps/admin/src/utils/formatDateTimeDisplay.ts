/** Display dates/times in Arabic locale with 12-hour clock (ص/م). */

const DISPLAY_TIME_ZONE = 'Asia/Riyadh'

export function formatDateTimeAr(iso: string | Date | null | undefined): string {
  if (iso == null || iso === '') return '-'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('ar-SA', {
    calendar: 'gregory',
    timeZone: DISPLAY_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
  })
}

export function formatDateAr(iso: string | Date | null | undefined): string {
  if (iso == null || iso === '') return '-'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('ar-SA', {
    calendar: 'gregory',
    timeZone: DISPLAY_TIME_ZONE,
  })
}

export function formatLongDateAr(iso: string | Date | null | undefined): string {
  if (iso == null || iso === '') return '-'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    calendar: 'gregory',
    timeZone: DISPLAY_TIME_ZONE,
  })
}

export function formatTimeAr(iso: string | Date | null | undefined): string {
  if (iso == null || iso === '') return '-'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('ar-SA', {
    timeZone: DISPLAY_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** For dayjs values or ISO strings shown in tables (Gregorian date + 12h time). */
export function formatDayjsDisplayAr(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '-'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('ar-SA', {
    calendar: 'gregory',
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
