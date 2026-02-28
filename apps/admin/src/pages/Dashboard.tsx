import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, DollarSign, CheckCircle, XCircle, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../api'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [overviewAll, setOverviewAll] = useState<{
    bookings: { total: number; confirmed: number; cancelled: number }
    scans: number
    revenueByMethod: Record<string, number>
  } | null>(null)
  const [todaysEventsCount, setTodaysEventsCount] = useState<number>(0)
  const [weekRevenue, setWeekRevenue] = useState<number>(0)
  const [pendingApprovals, setPendingApprovals] = useState<number>(0)
  const [recent, setRecent] = useState<
    Array<{
      id: string
      branch?: { name?: string; name_ar?: string; nameAr?: string; name_en?: string; nameEn?: string }
      hall?: { name?: string; name_ar?: string; nameAr?: string; name_en?: string; nameEn?: string }
      startTime?: string
      status?: string
    }>
  >([])

  useEffect(() => {
    ;(async () => {
      try {
        const ovAll = await apiGet<any>('/reports/overview')
        setOverviewAll(ovAll)
      } catch {}
      try {
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
        const res = await apiGet<any>(
          `/bookings/admin/all?from=${encodeURIComponent(startOfDay)}&to=${encodeURIComponent(endOfDay)}&limit=200`
        )
        const items = Array.isArray(res?.bookings) ? res.bookings : res?.items || []
        setTodaysEventsCount(items.length || 0)
      } catch {}
      try {
        const end = new Date()
        const start = new Date(end)
        start.setDate(end.getDate() - 7)
        const ovWeek = await apiGet<any>(
          `/reports/overview?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`
        )
        const revTotal = Object.values(ovWeek?.revenueByMethod || {}).reduce(
          (a: number, b: unknown) => a + Number(b || 0),
          0
        )
        setWeekRevenue(revTotal)
      } catch {}
      try {
        const resPending = await apiGet<any>('/bookings/admin/all?status=pending&limit=200')
        const itemsPending = Array.isArray(resPending?.bookings) ? resPending.bookings : resPending?.items || []
        setPendingApprovals(itemsPending.length || 0)
      } catch {}
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await apiGet<any>('/bookings/admin/all?page=1&limit=8')
        const displayName = (o?: { name?: string; name_ar?: string; nameAr?: string; name_en?: string; nameEn?: string }) =>
          o?.name ?? o?.name_ar ?? o?.nameAr ?? o?.name_en ?? o?.nameEn ?? ''
        const items = Array.isArray(res?.bookings) ? res.bookings : res?.items || []
        const normalized = items.map((b: any) => ({
          ...b,
          branch: b.branch ? { ...b.branch, name: displayName(b.branch) } : b.branch,
          hall: b.hall ? { ...b.hall, name: displayName(b.hall) } : b.hall,
        }))
        setRecent(normalized)
      } catch {}
    })()
  }, [])

  const revenueEntries = Object.entries(overviewAll?.revenueByMethod || {})

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
        return t('bookings.status_confirmed') || 'مؤكد'
      case 'pending':
        return t('bookings.status_pending') || 'معلق'
      case 'cancelled':
        return t('bookings.status_cancelled') || 'ملغي'
      case 'completed':
        return t('bookings.status_completed') || 'مكتمل'
      default:
        return status
    }
  }

  const totalRevenue = Object.values(overviewAll?.revenueByMethod || {}).reduce(
    (a: number, b: unknown) => a + Number(b || 0),
    0
  )

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {t('dashboard.title') || 'نظرة عامة على اللوحة'}
            </h1>
            <p className="mt-1 font-medium text-slate-600">
              {t('dashboard.subtitle') || 'راقب أداء عملك والمؤشرات الرئيسية'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/bookings/free-ticket')}
              className="border-primary text-primary hover:bg-primary/5"
            >
              <Calendar className="h-4 w-4" />
              إنشاء تذكرة مجانية
            </Button>
            <Button onClick={() => navigate('/admin/bookings')}>
              <Calendar className="h-4 w-4" />
              {t('dashboard.go_bookings') || 'الانتقال إلى الحجوزات'}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md group bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 group-hover:text-primary transition-colors">
              {t('reports.bookings_total') || 'إجمالي الحجوزات'}
            </CardTitle>
            <div className="rounded-lg bg-slate-50 p-2 transition-colors group-hover:bg-primary/10">
              <Calendar className="h-4 w-4 text-slate-600 group-hover:text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {overviewAll?.bookings?.total ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md group bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 group-hover:text-primary transition-colors">
              {t('reports.bookings_confirmed') || 'الحجوزات المؤكدة'}
            </CardTitle>
            <div className="rounded-lg bg-emerald-50 p-2 transition-colors group-hover:bg-emerald-100">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {overviewAll?.bookings?.confirmed ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md group bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 group-hover:text-primary transition-colors">
              {t('reports.bookings_cancelled') || 'الحجوزات الملغية'}
            </CardTitle>
            <div className="rounded-lg bg-rose-50 p-2 transition-colors group-hover:bg-rose-100">
              <XCircle className="h-4 w-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {overviewAll?.bookings?.cancelled ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md group bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 group-hover:text-primary transition-colors">
              {t('dashboard.kpi_revenue') || 'الإيرادات'}
            </CardTitle>
            <div className="rounded-lg bg-slate-50 p-2 transition-colors group-hover:bg-primary/10">
              <DollarSign className="h-4 w-4 text-slate-600 group-hover:text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {totalRevenue} <span className="text-base font-medium">SAR</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Method */}
      {revenueEntries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {revenueEntries.map(([k, v]) => (
            <Card key={k} className="border-slate-100 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">
                  {t('reports.revenue_by_method') || 'الإيرادات'}: {k}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-slate-900">
                  {Number(v)} SAR
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-100 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900">
                {t('dashboard.recent_activity') || 'آخر الأنشطة'}
              </CardTitle>
              <Button
                variant="link"
                className="font-medium text-primary h-auto p-0"
                onClick={() => navigate('/admin/bookings')}
              >
                {t('common.view_all') || 'عرض الكل'} <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {recent.length === 0 ? (
                  <p className="py-8 text-center text-slate-600">لا توجد حجوزات حديثة</p>
                ) : (
                  recent.map((item) => {
                    const branchName =
                      item.branch?.name ||
                      item.branch?.name_ar ||
                      item.branch?.nameAr ||
                      item.branch?.name_en ||
                      item.branch?.nameEn ||
                      ''
                    const locationText = branchName || 'غير محدد'
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 border-b border-slate-100 py-4 last:border-0"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-lg">
                          📅
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {t('dashboard.booking') || 'حجز'} #{String(item.id).slice(0, 8)}...
                            </span>
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                                getStatusBadgeClass(item.status || '')
                              )}
                            >
                              {getStatusText(item.status || '')}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{locationText}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.startTime
                              ? new Date(item.startTime).toLocaleString('ar-SA', { calendar: 'gregory' })
                              : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Summary */}
        <div className="space-y-6">
          <Card className="border-slate-100 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                {t('dashboard.status_summary') || 'ملخص الحالة'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-amber-800">
                      {t('dashboard.pending_approvals') || 'الموافقات المعلقة'}
                    </div>
                    <div className="text-xs text-slate-600">
                      {t('dashboard.school_trips_events') || 'الرحلات المدرسية والفعاليات'}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-amber-700">{pendingApprovals}</div>
                </div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-emerald-800">
                      {t('dashboard.todays_events') || 'فعاليات اليوم'}
                    </div>
                    <div className="text-xs text-slate-600">
                      {t('dashboard.active_bookings') || 'الحجوزات النشطة'}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">{todaysEventsCount}</div>
                </div>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-blue-800">
                      {t('dashboard.this_week') || 'هذا الأسبوع'}
                    </div>
                    <div className="text-xs text-slate-600">
                      {t('dashboard.revenue') || 'الإيرادات'}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-blue-700">
                    {weekRevenue} <span className="text-sm font-medium">SAR</span>
                  </div>
                </div>
              </div>
              <div className="pt-2 text-center">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {t('dashboard.keep_tracking') || 'استمر في متابعة المؤشرات'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
