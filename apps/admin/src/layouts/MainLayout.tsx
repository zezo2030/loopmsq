import { Layout, Menu } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'

const { Header, Sider, Content } = Layout

export default function MainLayout() {
  const location = useLocation()
  const selected = location.pathname.startsWith('/users')
    ? ['users']
    : location.pathname === '/'
    ? ['dashboard']
    : []

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div style={{ height: 48, margin: 16, background: 'rgba(255,255,255,0.2)' }} />
        <Menu theme="dark" mode="inline" selectedKeys={selected} items={[
          { key: 'dashboard', label: <Link to="/">Dashboard</Link> },
          { key: 'users', label: <Link to="/users">Users</Link> },
        ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 16px' }}>
          <span>Admin Dashboard</span>
        </Header>
        <Content style={{ margin: 16 }}>
          <div style={{ padding: 16, background: '#fff', minHeight: 360 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}


