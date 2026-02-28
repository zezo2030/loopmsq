import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  ChevronRight,
  FileText,
  TrendingUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { apiGet } from '../shared/api'
import { useAuth } from '../shared/auth'
import { resolveFileUrlWithBust } from '../shared/url'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const [overview, setOverview] = useState<{
    bookings: { total: number; confirmed: number; cancelled: number; pending?: number }
    scans: number
    revenueByMethod: Record<string, number>
  } | null>(null)
  const [recent, setRecent] = useState<
    Array<{
      id: string
      branch?: { name?: string; name_ar?: string; nameAr?: string; name_en?: string; nameEn?: string }
      hall?: { name?: string; name_ar?: string; nameAr?: string; name_en?: string; nameEn?: string }
      startTime?: string
      status?: string
    }>
  >([])
  const [branchData, setBranchData] = useState<{ coverImage?: string; images?: string[] } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const branchIdParam = me?.branchId ? `?branchId=${me.branchId}` : ''
        const ov = await apiGet<any>(`/reports/overview${branchIdParam}`)
        setOverview(ov)
      } catch {}
      try {
        const res = await apiGet<any>('/bookings/branch/me?page=1&limit=8')
        const items = Array.isArray(res?.bookings) ? res.bookings : res?.items || []
        const displayName = (o?: { name?: string; name_ar?: string; nameAr?: string; name_en?: string; nameEn?: string }) =>
          o?.name ?? o?.name_ar ?? o?.nameAr ?? o?.name_en ?? o?.nameEn ?? ''
        const normalized = items.map((b: any) => ({
          ...b,
          branch: b.branch ? { ...b.branch, name: displayName(b.branch) } : b.branch,
          hall: b.hall ? { ...b.hall, name: displayName(b.hall) } : b.hall,
        }))
        setRecent(normalized)
      } catch {}
      try {
        if (me?.branchId) {
          const branch = await apiGet<{ coverImage?: string; images?: string[] }>(
            `/content/branches/${me.branchId}`
          ) as { coverImage?: string; images?: string[] } | null
          setBranchData(branch)
        }
      } catch {}
    })()
  }, [me?.branchId])

  const revenueEntries = Object.entries(overview?.revenueByMethod || {})
  const totalRevenue = Object.values(overview?.revenueByMethod || {}).reduce(
    (a: number, b: unknown) => a + Number(b || 0),
    0
  )

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-emerald-50 text-emerald-600'
      case 'pending':
        return 'bg-amber-50 text-amber-600'
      case 'cancelled':
        return 'bg-rose-50 text-rose-600'
      default:
        return 'bg-slate-100 text-slate-600'
    }
  }

  return (
    <div className="space-y-8">
      {/* Branch Cover */}
      {branchData?.coverImage && (
        <Card className="overflow-hidden border-slate-100 p-0 shadow-sm">
          <img
            src={resolveFileUrlWithBust(branchData.coverImage)}
            alt="Branch Cover"
            className="h-48 w-full object-cover md:h-52"
          />
        </Card>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {t('dashboard.title') || 'نظرة عامة على الفرع'}
            </h1>
            <p className="mt-1 font-medium text-slate-600">
              {t('dashboard.subtitle') || 'راقب أداء فرعك والمؤشرات الرئيسية'}
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = '/branch/bookings'
            }}
          >
            <Calendar className="h-4 w-4" />
            {t('dashboard.go_bookings') || 'الانتقال إلى الحجوزات'}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 transition-colors group-hover:text-primary">
              {t('reports.bookings_total') || 'إجمالي الحجوزات'}
            </CardTitle>
            <div className="rounded-lg bg-slate-50 p-2 transition-colors group-hover:bg-primary/10">
              <Calendar className="h-4 w-4 text-slate-600 group-hover:text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {overview?.bookings?.total ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 transition-colors group-hover:text-primary">
              {t('reports.bookings_confirmed') || 'الحجوزات المؤكدة'}
            </CardTitle>
            <div className="rounded-lg bg-emerald-50 p-2 transition-colors group-hover:bg-emerald-100">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {overview?.bookings?.confirmed ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 transition-colors group-hover:text-primary">
              {t('reports.bookings_cancelled') || 'الحجوزات الملغية'}
            </CardTitle>
            <div className="rounded-lg bg-rose-50 p-2 transition-colors group-hover:bg-rose-100">
              <XCircle className="h-4 w-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {overview?.bookings?.cancelled ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 transition-colors group-hover:text-primary">
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
            <Card key={k} className="border-slate-100 bg-white shadow-sm">
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
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900">
                {t('dashboard.recent_activity') || 'آخر الأنشطة'}
              </CardTitle>
              <Button
                variant="link"
                className="h-auto p-0 font-medium text-primary"
                onClick={() => {
                  window.location.href = '/branch/bookings'
                }}
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
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg text-primary">
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
                              {item.status || ''}
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

        <div className="space-y-6">
          <Card className="border-slate-100 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                {t('dashboard.status_summary') || 'ملخص الحالة'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <div className="text-2xl font-bold text-emerald-700">
                    {overview?.bookings?.total || 0}
                  </div>
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
                    {totalRevenue} <span className="text-sm font-medium">SAR</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary text-primary hover:bg-primary/5"
                  onClick={() => {
                    window.location.href = '/branch/reports'
                  }}
                >
                  <FileText className="h-4 w-4" />
                  {t('dashboard.view_reports') || 'عرض التقارير'}
                </Button>
                <Button variant="outline" size="sm">
                  <TrendingUp className="h-4 w-4" />
                  {t('dashboard.analytics') || 'التحليلات'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Branch Images */}
      {branchData?.images && branchData.images.length > 0 && (
        <Card className="border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">
              {t('branch.images') || 'صور الفرع'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {branchData.images.map((imageUrl: string, index: number) => (
                <a
                  key={index}
                  href={resolveFileUrlWithBust(imageUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-slate-100 transition hover:opacity-90"
                >
                  <img
                    src={resolveFileUrlWithBust(imageUrl)}
                    alt={`Branch ${index + 1}`}
                    className="h-28 w-28 object-cover"
                  />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
