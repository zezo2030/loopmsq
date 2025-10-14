import { Menu, Button, Avatar, Dropdown, Space } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'
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

export default function MainLayout() {
  const location = useLocation()
  
  const getSelectedKeys = () => {
    const path = location.pathname
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

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile Settings',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <Link to="/settings">Preferences</Link>,
    },
    { 
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: handleLogout,
    },
  ]

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/">Dashboard</Link>,
    },
    {
      key: 'users',
      icon: <TeamOutlined />,
      label: 'User Management',
      children: [
        {
          key: 'users-list',
          icon: <UsergroupAddOutlined />,
          label: <Link to="/users" className="user-dropdown-link">
            <div className="user-dropdown-item">
              <span className="dropdown-item-text">All Users</span>
              <span className="dropdown-item-desc">Manage system users</span>
            </div>
          </Link>,
        },
        {
          key: 'create-staff',
          icon: <UserAddOutlined />,
          label: <Link to="/staff/new" className="user-dropdown-link">
            <div className="user-dropdown-item">
              <span className="dropdown-item-text">Add Staff</span>
              <span className="dropdown-item-desc">Add new staff member</span>
            </div>
          </Link>,
        },
        {
          key: 'create-manager',
          icon: <CrownOutlined />,
          label: <Link to="/branch-managers/new" className="user-dropdown-link">
            <div className="user-dropdown-item">
              <span className="dropdown-item-text">Add Manager</span>
              <span className="dropdown-item-desc">Add branch manager</span>
            </div>
          </Link>,
        },
      ],
    },
    {
      key: 'bookings',
      icon: <CalendarOutlined />,
      label: <Link to="/bookings">Bookings Management</Link>,
    },
    {
      key: 'trips',
      icon: <BookOutlined />,
      label: <Link to="/trips">School Trips</Link>,
    },
    {
      key: 'events',
      icon: <GiftOutlined />,
      label: <Link to="/events">Special Events</Link>,
    },
    {
      key: 'notifications',
      icon: <BellOutlined />,
      label: <Link to="/notifications">Notifications</Link>,
    },
    {
      key: 'cms',
      icon: <AppstoreOutlined />,
      label: 'CMS',
      children: [
        { key: 'cms-banners', icon: <PictureOutlined />, label: <Link to="/cms/banners">Banners</Link> },
        { key: 'cms-offers', icon: <TagsOutlined />, label: <Link to="/cms/offers">Offers</Link> },
        { key: 'cms-coupons', icon: <PercentageOutlined />, label: <Link to="/cms/coupons">Coupons</Link> },
        { key: 'cms-packages', icon: <GiftOutlined />, label: <Link to="/cms/packages">Packages</Link> },
      ],
    },
    {
      key: 'content',
      icon: <AppstoreOutlined />,
      label: 'Content',
      children: [
        { key: 'content-branches', icon: <AppstoreOutlined />, label: <Link to="/content/branches">Branches</Link> },
        { key: 'content-halls', icon: <AppstoreOutlined />, label: <Link to="/content/halls">Halls</Link> },
      ],
    },
    {
      key: 'finance',
      icon: <DollarOutlined />,
      label: 'Finance',
      children: [
        { key: 'finance-payments', icon: <DollarOutlined />, label: <Link to="/finance/payments">Payments</Link> },
        { key: 'finance-wallets', icon: <WalletOutlined />, label: <Link to="/finance/wallets">Wallets</Link> },
      ],
    },
    {
      key: 'marketing',
      icon: <RocketOutlined />,
      label: 'Marketing',
      children: [
        { key: 'marketing-loyalty', icon: <CrownOutlined />, label: <Link to="/marketing/loyalty">Loyalty</Link> },
        { key: 'marketing-referrals', icon: <UsergroupAddOutlined />, label: <Link to="/marketing/referrals">Referrals</Link> },
      ],
    },
    {
      key: 'feedback',
      icon: <StarOutlined />,
      label: 'Feedback',
      children: [
        { key: 'feedback-reviews', icon: <StarOutlined />, label: <Link to="/feedback/reviews">Reviews</Link> },
      ],
    },
    {
      key: 'support',
      icon: <BellOutlined />,
      label: 'Support',
      children: [
        { key: 'support-tickets', icon: <BellOutlined />, label: <Link to="/support/tickets">Tickets</Link> },
      ],
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
      children: [
        { key: 'reports-overview', icon: <BarChartOutlined />, label: <Link to="/reports/overview">Overview</Link> },
      ],
    },
  ]

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <div className="admin-sidebar">
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
          <div className="admin-content-wrapper">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard Overview'
  
  // Users Management
  if (pathname === '/users') return 'User Management'
  if (pathname.startsWith('/users/')) return 'User Details'
  if (pathname === '/staff/new') return 'Create Staff Member'
  if (pathname === '/branch-managers/new') return 'Create Branch Manager'
  
  // Bookings Management
  if (pathname === '/bookings') return 'Bookings Management'
  if (pathname.startsWith('/bookings/')) return 'Booking Details'
  
  // School Trips
  if (pathname === '/trips') return 'School Trips'
  if (pathname.startsWith('/trips/')) return 'Trip Details'
  
  // Special Events
  if (pathname === '/events') return 'Special Events'
  if (pathname.startsWith('/events/')) return 'Event Details'

  // CMS
  if (pathname === '/cms/banners') return 'CMS - Banners'
  if (pathname === '/cms/offers') return 'CMS - Offers'
  if (pathname === '/cms/coupons') return 'CMS - Coupons'
  if (pathname === '/cms/packages') return 'CMS - Packages'
  
  return 'Admin Control Panel'
}


