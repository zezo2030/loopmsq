import { Bell, Calendar, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { apiGet } from '@/api'
import { formatDateTimeAr } from '@/utils/formatDateTimeDisplay'
import { cn } from '@/lib/utils'

type NamedLike = { name?: string; name_ar?: string; nameAr?: string; name_en?: string; nameEn?: string }

type BookingRow = {
  id: string
  branch?: NamedLike
  hall?: NamedLike
  startTime?: string
  status?: string
  createdAt?: string
}

const displayName = (o?: NamedLike) => o?.name ?? o?.name_ar ?? o?.nameAr ?? o?.name_en ?? o?.nameEn ?? ''

export function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<BookingRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  const refreshPending = useCallback(async () => {
    try {
      const res = await apiGet<any>('/bookings/admin/all?status=pending&limit=200')
      const list = Array.isArray(res?.bookings) ? res.bookings : res?.items || []
      setPendingCount(list.length || 0)
    } catch {
      setPendingCount(0)
    }
  }, [])

  useEffect(() => {
    void refreshPending()
    const id = window.setInterval(() => void refreshPending(), 60_000)
    return () => window.clearInterval(id)
  }, [refreshPending])

  const loadRecent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<any>('/bookings/admin/all?page=1&limit=12')
      const raw = Array.isArray(res?.bookings) ? res.bookings : res?.items || []
      const sorted = [...raw].sort((a: any, b: any) => {
        const ta = new Date(a.createdAt || a.startTime || 0).getTime()
        const tb = new Date(b.createdAt || b.startTime || 0).getTime()
        return tb - ta
      })
      setItems(sorted)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadRecent()
  }, [open, loadRecent])

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-emerald-50 text-emerald-600'
      case 'pending':
        return 'bg-amber-50 text-amber-600'
      case 'cancelled':
        return 'bg-rose-50 text-rose-600'
      case 'completed':
        return 'bg-blue-50 text-blue-600'
      default:
        return 'bg-slate-100 text-slate-600'
    }
  }

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return t('bookings.status_confirmed')
      case 'pending':
        return t('bookings.status_pending')
      case 'cancelled':
        return t('bookings.status_cancelled')
      case 'completed':
        return t('bookings.status_completed')
      default:
        return status
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl text-slate-600 transition-all hover:bg-primary/5 hover:text-primary"
          aria-label={t('header.notifications.title')}
        >
          <Bell className="h-5 w-5" />
          {pendingCount > 0 && (
            <span className="absolute end-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,22rem)] p-0">
        <DropdownMenuLabel className="p-0">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <div className="text-base font-bold text-slate-900">{t('header.notifications.title')}</div>
            <p className="mt-0.5 text-xs font-normal text-slate-500">{t('header.notifications.subtitle')}</p>
          </div>
        </DropdownMenuLabel>
        <div className="max-h-[min(20rem,50vh)] overflow-y-auto py-1">
          {loading && (
            <div className="px-3 py-6 text-center text-sm text-slate-500">{t('common.loading')}</div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-slate-500">{t('header.notifications.empty')}</div>
          )}
          {!loading &&
            items.map((b) => {
              const branchName = displayName(b.branch)
              const hallName = displayName(b.hall)
              const title =
                branchName || hallName || t('header.notifications.booking_fallback')
              const subtitle =
                branchName && hallName && branchName !== hallName ? hallName : undefined
              const when = b.createdAt || b.startTime
              return (
                <DropdownMenuItem
                  key={b.id}
                  className="cursor-pointer flex-col items-start gap-1 rounded-none px-3 py-2.5 focus:bg-slate-50"
                  onSelect={(e) => {
                    e.preventDefault()
                    navigate(`/admin/bookings/${b.id}`)
                    setOpen(false)
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="line-clamp-2 text-start text-sm font-semibold text-slate-800">{title}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase',
                        getStatusBadgeClass(b.status || '')
                      )}
                    >
                      {getStatusText(b.status || '')}
                    </span>
                  </div>
                  {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
                  <span className="text-xs text-slate-500">{when ? formatDateTimeAr(when) : '—'}</span>
                </DropdownMenuItem>
              )
            })}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="flex flex-col gap-0.5 p-1">
          <DropdownMenuItem
            className="cursor-pointer justify-between text-primary"
            onSelect={(e) => {
              e.preventDefault()
              navigate('/admin/bookings?status=pending')
              setOpen(false)
            }}
          >
            <span className="text-sm font-semibold">{t('header.notifications.pending_link')}</span>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer justify-between text-slate-700"
            onSelect={(e) => {
              e.preventDefault()
              navigate('/admin/bookings')
              setOpen(false)
            }}
          >
            <span className="text-sm font-medium">{t('header.notifications.view_all')}</span>
            <Calendar className="h-4 w-4" />
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer justify-between text-slate-500"
            onSelect={(e) => {
              e.preventDefault()
              navigate('/admin/notifications')
              setOpen(false)
            }}
          >
            <span className="text-sm">{t('header.notifications.promo_push')}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
