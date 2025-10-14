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
  GiftOutlined
} from '@ant-design/icons'
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
      label: 'Preferences',
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
  
  return 'Admin Control Panel'
}


