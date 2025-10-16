import { Menu, Button, Avatar, Dropdown, Space, Tooltip } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import i18n from '../i18n'
import { 
  DashboardOutlined, 
  UserOutlined, 
  TeamOutlined,
  LogoutOutlined,
  SettingOutlined,
  BellOutlined,
  UsergroupAddOutlined,
  UserAddOutlined,
  CrownOutlined,
  CalendarOutlined,
  BookOutlined,
  GiftOutlined,
  PictureOutlined,
  PercentageOutlined,
  TagsOutlined,
  AppstoreOutlined,
  StarOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { DollarOutlined, WalletOutlined, RocketOutlined } from '@ant-design/icons'
import '../theme.css'
import { useTranslation } from 'react-i18next'

export default function MainLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    try {
      const lang = (localStorage.getItem('console_lang')) || 'ar'
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    } catch {}
  }, [])
  
  const getSelectedKeys = () => {
    const path = location.pathname.replace(/^\/admin/, '') || '/'
    if (path.startsWith('/users') || path.startsWith('/staff') || path.startsWith('/branch-managers')) {
      return ['users']
    }
    if (path.startsWith('/bookings')) {
      return ['bookings']
    }
    if (path.startsWith('/trips')) {
      return ['trips']
    }
  if (path.startsWith('/events')) {
      return ['events']
    }
  if (path.startsWith('/notifications')) {
    return ['notifications']
  }
  if (path.startsWith('/content/branches')) {
    return ['content-branches']
  }
  if (path.startsWith('/content/halls')) {
    return ['content-halls']
  }
  if (path.startsWith('/feedback/reviews')) {
    return ['feedback-reviews']
  }
  if (path.startsWith('/support/tickets')) {
    return ['support-tickets']
  }
  if (path.startsWith('/reports/overview')) {
    return ['reports-overview']
  }
    return [path === '/' ? 'dashboard' : path.replace('/', '')]
  }

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    window.location.href = '/login'
  }

  // Scroll selected menu item into view when route changes
  useEffect(() => {
    const container = sidebarRef.current || document.querySelector('.admin-menu') as HTMLElement | null
    if (!container) return
    const selected = container.querySelector('.ant-menu-item-selected, .ant-menu-submenu-selected') as HTMLElement | null
    if (selected && typeof selected.scrollIntoView === 'function') {
      selected.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [location.pathname])

  // Scroll main content to top on route changes
  useEffect(() => {
    if (contentRef.current) {
      try { contentRef.current.scrollTop = 0 } catch {}
    } else {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
    }
  }, [location.pathname])

  const userMenuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <Link to="/settings">{t('profile.preferences')}</Link>,
    },
    { 
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('profile.sign_out'),
      onClick: handleLogout,
    },
  ]

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/admin">{t('menu.dashboard')}</Link>,
    },
    {
      key: 'search',
      icon: <AppstoreOutlined />,
      label: <Link to="/admin/search">{t('menu.search') || 'Search'}</Link>,
    },
    {
      key: 'users',
      icon: <TeamOutlined />,
      label: t('menu.users'),
      children: [
        {
          key: 'users-list',
          icon: <UsergroupAddOutlined />,
          label: <Link to="/admin/users" className="user-dropdown-link">
            <div className="user-dropdown-item">
              <span className="dropdown-item-text">{t('users.all') || 'All Users'}</span>
              <span className="dropdown-item-desc">Manage system users</span>
            </div>
          </Link>,
        },
        {
          key: 'create-staff',
          icon: <UserAddOutlined />,
          label: <Link to="/admin/staff/new" className="user-dropdown-link">
            <div className="user-dropdown-item">
              <span className="dropdown-item-text">{t('users.add_staff') || 'Add Staff'}</span>
              <span className="dropdown-item-desc">Add new staff member</span>
            </div>
          </Link>,
        },
        {
          key: 'create-manager',
          icon: <CrownOutlined />,
          label: <Link to="/admin/branch-managers/new" className="user-dropdown-link">
            <div className="user-dropdown-item">
              <span className="dropdown-item-text">{t('users.add_manager') || 'Add Manager'}</span>
              <span className="dropdown-item-desc">Add branch manager</span>
            </div>
          </Link>,
        },
      ],
    },
    {
      key: 'bookings',
      icon: <CalendarOutlined />,
      label: <Link to="/admin/bookings">{t('menu.bookings')}</Link>,
    },
    {
      key: 'trips',
      icon: <BookOutlined />,
      label: <Link to="/admin/trips">{t('menu.trips')}</Link>,
    },
    {
      key: 'events',
      icon: <GiftOutlined />,
      label: <Link to="/admin/events">{t('menu.events')}</Link>,
    },
    {
      key: 'notifications',
      icon: <BellOutlined />,
      label: <Link to="/admin/notifications">{t('menu.notifications') || 'Notifications'}</Link>,
    },
    {
      key: 'cms',
      icon: <AppstoreOutlined />,
      label: t('menu.cms'),
      children: [
        { key: 'cms-banners', icon: <PictureOutlined />, label: <Link to="/admin/cms/banners">{t('cms.banners') || 'Banners'}</Link> },
        { key: 'cms-offers', icon: <TagsOutlined />, label: <Link to="/admin/cms/offers">{t('cms.offers') || 'Offers'}</Link> },
        { key: 'cms-coupons', icon: <PercentageOutlined />, label: <Link to="/admin/cms/coupons">{t('cms.coupons') || 'Coupons'}</Link> },
        { key: 'cms-packages', icon: <GiftOutlined />, label: <Link to="/admin/cms/packages">{t('cms.packages') || 'Packages'}</Link> },
      ],
    },
    {
      key: 'content',
      icon: <AppstoreOutlined />,
      label: t('menu.content'),
      children: [
        { key: 'content-branches', icon: <AppstoreOutlined />, label: <Link to="/admin/content/branches">{t('menu.content.branches')}</Link> },
        { key: 'content-halls', icon: <AppstoreOutlined />, label: <Link to="/admin/content/halls">{t('menu.content.halls')}</Link> },
      ],
    },
    {
      key: 'finance',
      icon: <DollarOutlined />,
      label: t('menu.finance'),
      children: [
        { key: 'finance-payments', icon: <DollarOutlined />, label: <Link to="/admin/finance/payments">{t('finance.payments') || 'Payments'}</Link> },
        { key: 'finance-wallets', icon: <WalletOutlined />, label: <Link to="/admin/finance/wallets">{t('finance.wallets') || 'Wallets'}</Link> },
      ],
    },
    {
      key: 'marketing',
      icon: <RocketOutlined />,
      label: t('menu.marketing'),
      children: [
        { key: 'marketing-loyalty', icon: <CrownOutlined />, label: <Link to="/admin/marketing/loyalty">{t('marketing.loyalty') || 'Loyalty'}</Link> },
        { key: 'marketing-referrals', icon: <UsergroupAddOutlined />, label: <Link to="/admin/marketing/referrals">{t('marketing.referrals') || 'Referrals'}</Link> },
      ],
    },
    {
      key: 'feedback',
      icon: <StarOutlined />,
      label: t('menu.feedback'),
      children: [
        { key: 'feedback-reviews', icon: <StarOutlined />, label: <Link to="/admin/feedback/reviews">{t('menu.feedback.reviews')}</Link> },
      ],
    },
    {
      key: 'support',
      icon: <BellOutlined />,
      label: t('menu.support'),
      children: [
        { key: 'support-tickets', icon: <BellOutlined />, label: <Link to="/admin/support/tickets">{t('menu.support.tickets')}</Link> },
      ],
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: t('menu.reports'),
      children: [
        { key: 'reports-overview', icon: <BarChartOutlined />, label: <Link to="/admin/reports/overview">{t('menu.reports.overview')}</Link> },
      ],
    },
  ]

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar" ref={sidebarRef}>
        <div className="admin-logo">
          🏢 Admin Control
        </div>
        <Menu
          className="admin-menu"
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
        />
      </div>
      
      {/* Main Content */}
      <div className="admin-main-layout">
        {/* Header */}
        <div className="admin-header">
          <h1 className="admin-header-title">
            {getPageTitle(location.pathname)}
          </h1>
          
          <div className="admin-header-actions">
            <Space size="middle">
              <Tooltip title={i18n.language === 'ar' ? 'English' : 'العربية'}>
                <Button
                  type="text"
                  size="large"
                  onClick={() => {
                    const next = i18n.language === 'ar' ? 'en' : 'ar'
                    i18n.changeLanguage(next)
                    try {
                      localStorage.setItem('console_lang', next)
                      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
                    } catch {}
                  }}
                >
                  {i18n.language === 'ar' ? 'EN' : 'AR'}
                </Button>
              </Tooltip>
              <Link to="/api/v1/queues" target="_blank">
                <Button 
                  type="text" 
                  icon={<BellOutlined />} 
                  size="large"
                />
              </Link>
              
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                trigger={['click']}
              >
                <Button type="text" size="large">
                  <Space>
                    <Avatar 
                      size="small" 
                      icon={<UserOutlined />}
                      style={{ backgroundColor: '#3b82f6' }}
                    />
                    Admin
                  </Space>
                </Button>
              </Dropdown>
            </Space>
          </div>
        </div>
        
        {/* Content */}
        <div className="admin-content">
          <div className="admin-content-wrapper" ref={contentRef}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

function getPageTitle(pathname: string): string {
  const { t } = useTranslation()
  
  const path = pathname.replace(/^\/admin/, '') || '/'
  if (path === '/') return t('page.dashboard_overview')
  
  // Users Management
  if (path === '/users') return t('page.user_management')
  if (path.startsWith('/users/')) return t('page.user_details')
  if (path === '/staff/new') return t('page.create_staff')
  if (path === '/branch-managers/new') return t('page.create_branch_manager')
  
  // Bookings Management
  if (path === '/bookings') return t('page.bookings_management')
  if (path.startsWith('/bookings/')) return t('page.booking_details')
  
  // School Trips
  if (path === '/trips') return t('page.school_trips')
  if (path.startsWith('/trips/')) return t('page.trip_details')
  
  // Special Events
  if (path === '/events') return t('page.special_events')
  if (path.startsWith('/events/')) return t('page.event_details')

  // CMS
  if (path === '/cms/banners') return t('page.cms_banners')
  if (path === '/cms/offers') return t('page.cms_offers')
  if (path === '/cms/coupons') return t('page.cms_coupons')
  if (path === '/cms/packages') return t('page.cms_packages')
  
  return t('page.admin_control')
}


