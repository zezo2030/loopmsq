import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  Ticket,
  CreditCard,
  Star,
  LifeBuoy,
  ChevronRight,
  CheckCheck,
  Trash2,
  Package,
  Tag,
  Image as ImageIcon,
  Trash,
  PackagePlus,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { apiDelete, apiGet, apiPatch } from '@/api'
import { formatDateTimeAr } from '@/utils/formatDateTimeDisplay'
import { cn } from '@/lib/utils'
import {
  subscribeAdminNotifications,
  type AdminNotificationEvent,
} from '@/shared/realtime'

type AdminNotification = AdminNotificationEvent

const SEVERITY_STYLES: Record<AdminNotification['severity'], { bg: string; text: string; ring: string }> = {
  info: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200' },
  critical: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-200' },
}

function iconFor(type: string) {
  switch (type) {
    case 'OFFER_PURCHASED':
    case 'OFFER_TICKET_SCANNED':
      return Ticket
    case 'PAYMENT_SUCCESS':
    case 'PAYMENT_FAILED':
      return CreditCard
    case 'REVIEW_NEGATIVE':
      return Star
    case 'SUPPORT_TICKET_CREATED':
      return LifeBuoy
    case 'BOOKING_CANCELLED':
      return AlertTriangle
    case 'BOOKING_CREATED':
      return CheckCircle
    case 'ADDON_CREATED':
    case 'OFFER_PRODUCT_CREATED':
    case 'SUBSCRIPTION_PLAN_CREATED':
      return PackagePlus
    case 'ADDON_DELETED':
    case 'OFFER_PRODUCT_DELETED':
    case 'SUBSCRIPTION_PLAN_DELETED':
      return Trash
    case 'OFFER_CREATED':
    case 'OFFER_DELETED':
      return Tag
    case 'COUPON_CREATED':
    case 'COUPON_DELETED':
      return Package
    case 'BANNER_CREATED':
    case 'BANNER_DELETED':
      return ImageIcon
    default:
      return Info
  }
}

function routeFor(n: AdminNotification): string | null {
  switch (n.resourceType) {
    case 'booking':
      return n.resourceId ? `/admin/bookings/${n.resourceId}` : '/admin/bookings'
    case 'offer_booking':
      return n.resourceId
        ? `/admin/finance/offer-bookings/${n.resourceId}`
        : '/admin/finance/offer-bookings'
    case 'offer_ticket':
      return '/admin/finance/offer-bookings'
    case 'subscription_purchase':
      return n.resourceId
        ? `/admin/finance/subscriptions/${n.resourceId}`
        : '/admin/finance/subscriptions'
    case 'payment':
      return n.resourceId
        ? `/admin/finance/payments/${n.resourceId}`
        : '/admin/finance/payments'
    case 'support_ticket':
      return '/admin/support/tickets'
    case 'review':
      return '/admin/feedback/reviews'
    case 'trip_request':
      return n.resourceId ? `/admin/trips/${n.resourceId}` : '/admin/trips'
    case 'event_request':
      return n.resourceId ? `/admin/events/${n.resourceId}` : '/admin/events'
    case 'addon':
      return '/admin/content/addons'
    case 'school_trip_addon':
      return '/admin/content/school-addons'
    case 'special_booking_addon':
      return '/admin/content/private-event-addons'
    case 'offer':
      return '/admin/cms/offers'
    case 'offer_product':
      return '/admin/cms/offer-products'
    case 'coupon':
      return '/admin/cms/coupons'
    case 'banner':
      return '/admin/cms/banners'
    case 'subscription_plan':
      return '/admin/cms/subscription-plans'
    default:
      return null
  }
}

function tryNotifyBrowser(n: AdminNotification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(n.title, { body: n.body, tag: n.id })
  } catch {}
}

function tryBeep(severity: AdminNotification['severity']) {
  // Soft beep using WebAudio. Avoid extra assets.
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = severity === 'critical' ? 880 : 660
    g.gain.value = 0.05
    o.start()
    setTimeout(() => {
      o.stop()
      ctx.close()
    }, severity === 'critical' ? 200 : 120)
  } catch {}
}

export function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const refreshUnread = useCallback(async () => {
    try {
      const res = await apiGet<{ count: number }>('/admin/notifications/unread-count')
      setUnreadCount(res?.count || 0)
    } catch {
      // ignore
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<{ items: AdminNotification[] }>(
        '/admin/notifications?page=1&limit=20',
      )
      setItems(Array.isArray(res?.items) ? res.items : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Request browser permission once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }
    }
  }, [])

  // Initial load + lightweight poll fallback in case WS is unreachable
  useEffect(() => {
    void refreshUnread()
    const id = window.setInterval(() => void refreshUnread(), 60_000)
    return () => window.clearInterval(id)
  }, [refreshUnread])

  // WebSocket: prepend incoming admin events
  useEffect(() => {
    const unsubscribe = subscribeAdminNotifications((n) => {
      setItems((prev) => {
        // de-dupe by id
        if (prev.some((p) => p.id === n.id)) return prev
        return [n, ...prev].slice(0, 50)
      })
      setUnreadCount((c) => c + 1)
      tryNotifyBrowser(n)
      tryBeep(n.severity)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (open) void loadList()
  }, [open, loadList])

  const markOne = async (id: string) => {
    try {
      await apiPatch(`/admin/notifications/${id}/read`, {})
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isRead: true } : p)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {}
  }

  const markAll = async () => {
    try {
      await apiPatch('/admin/notifications/read-all', {})
      setItems((prev) => prev.map((p) => ({ ...p, isRead: true })))
      setUnreadCount(0)
    } catch {}
  }

  const removeOne = async (id: string) => {
    try {
      await apiDelete(`/admin/notifications/${id}`)
      setItems((prev) => prev.filter((p) => p.id !== id))
    } catch {}
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
          {unreadCount > 0 && (
            <span className="absolute end-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,26rem)] p-0">
        <DropdownMenuLabel className="p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div>
              <div className="text-base font-bold text-slate-900">
                {t('header.notifications.title')}
              </div>
              <p className="mt-0.5 text-xs font-normal text-slate-500">
                {t('header.notifications.subtitle')}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  void markAll()
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('header.notifications.mark_all_read', { defaultValue: 'تعليم الكل كمقروء' })}
              </button>
            )}
          </div>
        </DropdownMenuLabel>
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto py-1">
          {loading && (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              {t('common.loading')}
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              {t('header.notifications.empty')}
            </div>
          )}
          {!loading &&
            items.map((n) => {
              const Icon = iconFor(n.type)
              const style = SEVERITY_STYLES[n.severity] || SEVERITY_STYLES.info
              return (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(
                    'cursor-pointer flex-col items-start gap-1 rounded-none px-3 py-2.5 focus:bg-slate-50',
                    !n.isRead && 'bg-primary/[0.03]',
                  )}
                  onSelect={(e) => {
                    e.preventDefault()
                    if (!n.isRead) void markOne(n.id)
                    const path = routeFor(n)
                    if (path) {
                      navigate(path)
                      setOpen(false)
                    }
                  }}
                >
                  <div className="flex w-full items-start gap-2.5">
                    <span
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1',
                        style.bg,
                        style.ring,
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', style.text)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-start text-sm font-semibold text-slate-800">
                          {n.title}
                        </span>
                        {!n.isRead && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                        {n.body}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          {n.createdAt ? formatDateTimeAr(n.createdAt) : ''}
                        </span>
                        <button
                          type="button"
                          aria-label="حذف"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            void removeOne(n.id)
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </DropdownMenuItem>
              )
            })}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="flex flex-col gap-0.5 p-1">
          <DropdownMenuItem
            className="cursor-pointer justify-between text-slate-700"
            onSelect={(e) => {
              e.preventDefault()
              navigate('/admin/bookings')
              setOpen(false)
            }}
          >
            <span className="text-sm font-medium">{t('header.notifications.view_all')}</span>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
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
