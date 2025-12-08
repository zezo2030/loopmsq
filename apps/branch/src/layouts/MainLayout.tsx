import { Menu, Button, Avatar, Dropdown, Space, Tooltip } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import i18n from '../i18n'
import { 
  DashboardOutlined, 
  UserOutlined, 
  LogoutOutlined,
  SettingOutlined,
  BellOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  TeamOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import '../theme.css'
import { useTranslation } from 'react-i18next'

export default function MainLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLDivElement | null>(null)
  
  useEffect(() => {
    try {
      const lang = (localStorage.getItem('branch_lang')) || 'ar'
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    } catch {}
  }, [])
  
  const getSelectedKeys = () => {
    const path = location.pathname
    if (path.startsWith('/branch')) {
      return ['branch']
    }
  if (path.startsWith('/offers')) {
    return ['offers']
  }
  if (path.startsWith('/coupons')) {
    return ['coupons']
  }
    if (path.startsWith('/bookings')) {
      return ['bookings']
    }
    if (path.startsWith('/staff')) {
      return ['staff']
    }
    if (path.startsWith('/reports')) {
      return ['reports']
    }
    return [path === '/' ? 'dashboard' : path.replace('/', '')]
  }

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    window.location.href = '/login'
  }

  // Scroll selected menu item into view when route changes
  useEffect(() => {
    const container = sidebarRef.current || document.querySelector('.branch-menu') as HTMLElement | null
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
      key: 'profile',
      icon: <UserOutlined />,
      label: t('profile.settings'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: t('profile.preferences'),
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
      label: <Link to="/">{t('menu.dashboard')}</Link>,
    },
    {
      key: 'branch',
      icon: <AppstoreOutlined />,
      label: <Link to="/branch">{t('menu.branch')}</Link>,
    },
    {
      key: 'offers',
      icon: <AppstoreOutlined />,
      label: <Link to="/offers">{t('menu.offers') || 'Offers'}</Link>,
    },
    {
      key: 'coupons',
      icon: <AppstoreOutlined />,
      label: <Link to="/coupons">{t('menu.coupons') || 'Coupons'}</Link>,
    },
    {
      key: 'bookings',
      icon: <CalendarOutlined />,
      label: <Link to="/bookings">{t('menu.bookings')}</Link>,
    },
    {
      key: 'staff',
      icon: <TeamOutlined />,
      label: <Link to="/staff">{t('menu.staff')}</Link>,
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: <Link to="/reports">{t('menu.reports')}</Link>,
    },
  ]

  return (
    <div className="branch-layout">
      {/* Sidebar */}
      <div className="branch-sidebar" ref={sidebarRef}>
        <div className="branch-logo">
          🏢 Branch Manager
        </div>
        <Menu
          className="branch-menu"
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
        />
      </div>
      
      {/* Main Content */}
      <div className="branch-main-layout">
        {/* Header */}
        <div className="branch-header">
          <h1 className="branch-header-title">
            {getPageTitle(location.pathname)}
          </h1>
          
          <div className="branch-header-actions">
            <Space size="middle">
              <Tooltip title={i18n.language === 'ar' ? 'English' : 'العربية'}>
                <Button
                  type="text"
                  size="large"
                  onClick={() => {
                    const next = i18n.language === 'ar' ? 'en' : 'ar'
                    i18n.changeLanguage(next)
                    try {
                      localStorage.setItem('branch_lang', next)
                      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
                    } catch {}
                  }}
                >
                  {i18n.language === 'ar' ? 'EN' : 'AR'}
                </Button>
              </Tooltip>
              
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
                    Branch Manager
                  </Space>
                </Button>
              </Dropdown>
            </Space>
          </div>
        </div>
        
        {/* Content */}
        <div className="branch-content">
          <div className="branch-content-wrapper" ref={contentRef}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

function getPageTitle(pathname: string): string {
  const { t } = useTranslation()
  
  if (pathname === '/') return t('page.dashboard_overview')
  if (pathname === '/branch') return t('page.branch_info')
  if (pathname === '/offers') return t('page.offers_management')
  if (pathname === '/coupons') return t('page.coupons_management')
  if (pathname === '/bookings') return t('page.bookings_management')
  if (pathname === '/staff') return t('page.staff_management')
  if (pathname === '/reports') return t('page.reports_overview')
  
  return t('page.branch_control')
}
