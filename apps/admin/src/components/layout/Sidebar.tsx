import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import {
  LayoutDashboard,
  Search,
  Users,
  Calendar,
  Gift,
  BookOpen,
  Bell,
  LayoutGrid,
  Folder,
  DollarSign,
  Rocket,
  Star,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

const navItems: Array<{
  key: string
  href?: string
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
  children?: Array<{ key: string; href: string; labelKey: string }>
}> = [
  { key: 'dashboard', href: '/admin', labelKey: 'menu.dashboard', icon: LayoutDashboard },
  { key: 'search', href: '/admin/search', labelKey: 'menu.search', icon: Search },
  {
    key: 'users',
    labelKey: 'menu.users',
    icon: Users,
    children: [
      { key: 'users-list', href: '/admin/users', labelKey: 'users.all' },
      { key: 'clients', href: '/admin/clients', labelKey: 'users.clients.title' },
      { key: 'create-staff', href: '/admin/staff/new', labelKey: 'users.add_staff' },
      { key: 'create-manager', href: '/admin/branch-managers/new', labelKey: 'users.add_manager' },
    ],
  },
  {
    key: 'bookings',
    labelKey: 'menu.bookings',
    icon: Calendar,
    children: [
      { key: 'bookings-list', href: '/admin/bookings', labelKey: 'menu.bookings' },
      { key: 'bookings-free-ticket', href: '/admin/bookings/free-ticket', labelKey: 'bookings.free_ticket' },
    ],
  },
  { key: 'trips', href: '/admin/trips', labelKey: 'menu.trips', icon: BookOpen },
  { key: 'events', href: '/admin/events', labelKey: 'menu.events', icon: Gift },
  { key: 'notifications', href: '/admin/notifications', labelKey: 'menu.notifications', icon: Bell },
  {
    key: 'cms',
    labelKey: 'menu.cms',
    icon: LayoutGrid,
    children: [
      { key: 'cms-banners', href: '/admin/cms/banners', labelKey: 'cms.banners' },
      { key: 'cms-offers', href: '/admin/cms/offers', labelKey: 'cms.offers' },
      { key: 'cms-coupons', href: '/admin/cms/coupons', labelKey: 'cms.coupons' },
      { key: 'cms-activities', href: '/admin/cms/activities', labelKey: 'cms.activities' },
      { key: 'cms-organizing-branches', href: '/admin/cms/organizing-branches', labelKey: 'cms.organizingBranches' },
    ],
  },
  {
    key: 'content',
    labelKey: 'menu.content',
    icon: Folder,
    children: [
      { key: 'content-branches', href: '/admin/content/branches', labelKey: 'menu.content.branches' },
      { key: 'content-addons', href: '/admin/content/addons', labelKey: 'menu.content.addons' },
    ],
  },
  {
    key: 'finance',
    labelKey: 'menu.finance',
    icon: DollarSign,
    children: [
      { key: 'finance-payments', href: '/admin/finance/payments', labelKey: 'finance.payments' },
      { key: 'finance-wallets', href: '/admin/finance/wallets', labelKey: 'finance.wallets' },
    ],
  },
  {
    key: 'marketing',
    labelKey: 'menu.marketing',
    icon: Rocket,
    children: [
      { key: 'marketing-loyalty', href: '/admin/marketing/loyalty', labelKey: 'marketing.loyalty' },
      { key: 'marketing-referrals', href: '/admin/marketing/referrals', labelKey: 'marketing.referrals' },
    ],
  },
  {
    key: 'feedback',
    labelKey: 'menu.feedback',
    icon: Star,
    children: [{ key: 'feedback-reviews', href: '/admin/feedback/reviews', labelKey: 'menu.feedback.reviews' }],
  },
  {
    key: 'support',
    labelKey: 'menu.support',
    icon: MessageSquare,
    children: [{ key: 'support-tickets', href: '/admin/support/tickets', labelKey: 'menu.support.tickets' }],
  },
  {
    key: 'reports',
    labelKey: 'menu.reports',
    icon: BarChart3,
    children: [{ key: 'reports-overview', href: '/admin/reports/overview', labelKey: 'menu.reports.overview' }],
  },
  { key: 'settings', href: '/admin/settings', labelKey: 'menu.settings', icon: Settings },
]

function isPathActive(pathname: string, item: (typeof navItems)[0]): boolean {
  if (item.href) return pathname === item.href || (item.href === '/admin' && pathname === '/admin')
  if (item.children) {
    return item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))
  }
  return false
}

function isChildActive(pathname: string, item: (typeof navItems)[0]): boolean {
  if (!item.children) return false
  return item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))
}

export function Sidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const { t } = useTranslation()
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const keys: string[] = []
    navItems.forEach((item) => {
      if (item.children && isChildActive(pathname, item)) keys.push(item.key)
    })
    return keys.length ? keys : ['dashboard']
  })

  const toggleOpen = (key: string) => {
    setOpenKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-100 bg-white shadow-sm shadow-slate-200/50">
      <div className="flex h-20 items-center gap-3 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30 rotate-3">
          <LayoutDashboard className="h-6 w-6 text-primary-foreground -rotate-3" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tighter text-slate-900 uppercase">
          Loop <span className="text-primary italic">Admin</span>
        </h1>
      </div>
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
        {navItems.map((item) => {
          const isActive = isPathActive(pathname, item)
          const hasChildren = item.children && item.children.length > 0
          const isOpen = openKeys.includes(item.key)

          if (hasChildren) {
            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() => toggleOpen(item.key)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300',
                    isChildActive(pathname, item)
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {t(item.labelKey)}
                  {isOpen ? (
                    <ChevronDown className="ms-auto h-4 w-4" />
                  ) : (
                    <ChevronRight className="ms-auto h-4 w-4" />
                  )}
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-0.5 ps-4">
                    {item.children!.map((child) => {
                      const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                      return (
                        <Link
                          key={child.key}
                          to={child.href}
                          className={cn(
                            'group flex items-center gap-3 rounded-lg px-4 py-2.5 text-xs font-medium transition-all duration-200',
                            childActive ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-primary'
                          )}
                        >
                          {t(child.labelKey)}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.key}
              to={item.href!}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300',
                isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
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
