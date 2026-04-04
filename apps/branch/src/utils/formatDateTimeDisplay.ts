/** Display dates/times in Arabic locale with 12-hour clock (ص/م). */

export function formatDateTimeAr(iso: string | Date | null | undefined): string {
  if (iso == null || iso === '') return '-'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('ar-SA', {
    calendar: 'gregory',
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
  })
}

export function formatTimeAr(iso: string | Date | null | undefined): string {
  if (iso == null || iso === '') return '-'
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('ar-SA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatDayjsDisplayAr(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '-'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('ar-SA', {
    calendar: 'gregory',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
