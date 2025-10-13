import { Menu, Button, Avatar, Dropdown, Space } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { 
  DashboardOutlined, 
  UserOutlined, 
  TeamOutlined,
  LogoutOutlined,
  SettingOutlined,
  BellOutlined
} from '@ant-design/icons'
import '../theme.css'

export default function MainLayout() {
  const location = useLocation()
  
  const getSelectedKeys = () => {
    const path = location.pathname
    if (path.startsWith('/users') || path.startsWith('/staff') || path.startsWith('/branch-managers')) {
      return ['users']
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
          label: <Link to="/users">All Users</Link>,
        },
        {
          key: 'create-staff',
          label: <Link to="/staff/new">Add Staff</Link>,
        },
        {
          key: 'create-manager',
          label: <Link to="/branch-managers/new">Add Manager</Link>,
        },
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
              <Button 
                type="text" 
                icon={<BellOutlined />} 
                size="large"
              />
              
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
  if (pathname === '/users') return 'User Management'
  if (pathname.startsWith('/users/')) return 'User Details'
  if (pathname === '/staff/new') return 'Create Staff Member'
  if (pathname === '/branch-managers/new') return 'Create Branch Manager'
  return 'Admin Control Panel'
}


