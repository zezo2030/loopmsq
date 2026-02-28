import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  Tags,
  Percent,
  Calendar,
  Users,
  BarChart3,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

const navItems = [
  { key: 'dashboard', href: '/branch', labelKey: 'menu.dashboard', icon: LayoutDashboard },
  { key: 'branch', href: '/branch/branch', labelKey: 'menu.branch', icon: Building2 },
  { key: 'offers', href: '/branch/offers', labelKey: 'cms.offers', icon: Tags },
  { key: 'coupons', href: '/branch/coupons', labelKey: 'cms.coupons', icon: Percent },
  { key: 'bookings', href: '/branch/bookings', labelKey: 'menu.bookings', icon: Calendar },
  { key: 'staff', href: '/branch/staff', labelKey: 'menu.staff', icon: Users },
  { key: 'reports', href: '/branch/reports', labelKey: 'menu.reports', icon: BarChart3 },
]

export function BranchSidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const { t } = useTranslation()

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-100 bg-white shadow-sm shadow-slate-200/50">
      <div className="flex h-20 items-center gap-3 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30 rotate-3">
          <LayoutDashboard className="h-6 w-6 text-primary-foreground -rotate-3" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tighter text-slate-900 uppercase">
          Loop <span className="text-primary italic">Branch</span>
        </h1>
      </div>
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === '/branch' && pathname === '/branch')
          return (
            <Link
              key={item.key}
              to={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.labelKey)}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
