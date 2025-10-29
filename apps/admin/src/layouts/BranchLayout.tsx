import { Menu, Button, Avatar, Dropdown, Space, Tooltip } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import i18n from '../i18n'
import { 
  DashboardOutlined, 
  UserOutlined, 
  LogoutOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  TeamOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import '../theme.css'
import { useTranslation } from 'react-i18next'

export default function BranchLayout() {
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
    const path = location.pathname.replace(/^\/branch/, '') || '/'
    if (path.startsWith('/branch')) {
      return ['branch']
    }
    if (path.startsWith('/halls')) {
      return ['halls']
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
      label: <Link to="/branch">{t('menu.dashboard')}</Link>,
    },
    {
      key: 'branch',
      icon: <AppstoreOutlined />,
      label: <Link to="/branch/branch">{t('menu.branch')}</Link>,
    },
    {
      key: 'halls',
      icon: <AppstoreOutlined />,
      label: <Link to="/branch/halls">{t('menu.halls')}</Link>,
    },
    {
      key: 'offers',
      icon: <AppstoreOutlined />,
      label: <Link to="/branch/offers">{t('cms.offers') || 'Offers'}</Link>,
    },
    {
      key: 'coupons',
      icon: <AppstoreOutlined />,
      label: <Link to="/branch/coupons">{t('cms.coupons') || 'Coupons'}</Link>,
    },
    {
      key: 'bookings',
      icon: <CalendarOutlined />,
      label: <Link to="/branch/bookings">{t('menu.bookings')}</Link>,
    },
    {
      key: 'staff',
      icon: <TeamOutlined />,
      label: <Link to="/branch/staff">{t('menu.staff')}</Link>,
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: <Link to="/branch/reports">{t('menu.reports')}</Link>,
    },
  ]

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar" ref={sidebarRef}>
        <div className="admin-logo">
          🏢 Branch Manager
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
  
  if (pathname === '/branch' || pathname === '/branch/') return t('page.dashboard_overview')
  if (pathname.startsWith('/branch/branch')) return t('page.branch_info')
  if (pathname.startsWith('/branch/halls')) return t('page.halls_management')
  if (pathname.startsWith('/branch/offers')) return t('page.cms_offers')
  if (pathname.startsWith('/branch/coupons')) return t('page.cms_coupons')
  if (pathname.startsWith('/branch/bookings')) return t('page.bookings_management')
  if (pathname.startsWith('/branch/staff')) return t('page.staff_management')
  if (pathname.startsWith('/branch/reports')) return t('page.reports_overview')
  
  return t('page.branch_control')
}


