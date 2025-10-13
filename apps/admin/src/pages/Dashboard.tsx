import { Row, Col, Card, Statistic, Progress, List, Avatar, Button, Space, Tag } from 'antd'
import { 
  UserOutlined, 
  TeamOutlined, 
  ShopOutlined, 
  CalendarOutlined,
  TrophyOutlined,
  RiseOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons'
import '../theme.css'

export default function Dashboard() {
  const statsData = [
    {
      title: 'Total Users',
      value: 2847,
      prefix: <UserOutlined />,
      suffix: 'users',
      change: 12.5,
      trend: 'up'
    },
    {
      title: 'Active Staff',
      value: 24,
      prefix: <TeamOutlined />,
      suffix: 'staff',
      change: -2.3,
      trend: 'down'
    },
    {
      title: 'Branches',
      value: 8,
      prefix: <ShopOutlined />,
      suffix: 'locations',
      change: 0,
      trend: 'stable'
    },
    {
      title: 'Monthly Revenue',
      value: 125000,
      prefix: '$',
      suffix: 'SAR',
      change: 8.7,
      trend: 'up'
    }
  ]

  const recentActivities = [
    {
      title: 'New user registration',
      description: 'Ahmed Mohammed joined the platform',
      avatar: '👤',
      time: '2 minutes ago'
    },
    {
      title: 'Booking confirmed',
      description: 'Hall A1 booked for Saturday event',
      avatar: '📅',
      time: '15 minutes ago'
    },
    {
      title: 'Staff member added',
      description: 'Sarah Ali added as branch manager',
      avatar: '👥',
      time: '1 hour ago'
    },
    {
      title: 'Payment received',
      description: 'Payment of 2,500 SAR processed',
      avatar: '💰',
      time: '2 hours ago'
    }
  ]

  const topPerformers = [
    { name: 'Riyadh Branch', score: 98, bookings: 145 },
    { name: 'Jeddah Branch', score: 94, bookings: 128 },
    { name: 'Dammam Branch', score: 89, bookings: 112 }
  ]

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">Dashboard Overview</h1>
            <p className="page-subtitle">Monitor your business performance and key metrics</p>
          </div>
          <Space>
            <Button type="primary" className="btn-primary" icon={<CalendarOutlined />}>
              View Reports
            </Button>
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Stats Cards */}
          <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
            {statsData.map((stat, index) => (
              <Col xs={24} sm={12} lg={6} key={index}>
                <Card className="custom-card">
                  <Statistic
                    title={stat.title}
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    valueStyle={{ 
                      color: stat.trend === 'up' ? '#10b981' : stat.trend === 'down' ? '#ef4444' : '#3b82f6',
                      fontSize: '28px',
                      fontWeight: 'bold'
                    }}
                  />
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {stat.trend === 'up' && (
                      <>
                        <ArrowUpOutlined style={{ color: '#10b981' }} />
                        <span style={{ color: '#10b981', fontSize: '14px' }}>
                          +{stat.change}% from last month
                        </span>
                      </>
                    )}
                    {stat.trend === 'down' && (
                      <>
                        <ArrowDownOutlined style={{ color: '#ef4444' }} />
                        <span style={{ color: '#ef4444', fontSize: '14px' }}>
                          {stat.change}% from last month
                        </span>
                      </>
                    )}
                    {stat.trend === 'stable' && (
                      <span style={{ color: '#64748b', fontSize: '14px' }}>
                        No change from last month
                      </span>
                    )}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[24, 24]}>
            {/* Recent Activity */}
            <Col xs={24} lg={16}>
              <Card 
                className="custom-card"
                title="Recent Activity" 
                extra={<Button type="link">View All</Button>}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={recentActivities}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar 
                            size={40}
                            style={{ backgroundColor: '#dbeafe', fontSize: '18px' }}
                          >
                            {item.avatar}
                          </Avatar>
                        }
                        title={<span style={{ fontWeight: '600' }}>{item.title}</span>}
                        description={
                          <div>
                            <div style={{ marginBottom: '4px' }}>{item.description}</div>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>
                              {item.time}
                            </span>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            {/* Top Performers */}
            <Col xs={24} lg={8}>
              <Card 
                className="custom-card"
                title={
                  <Space>
                    <TrophyOutlined style={{ color: '#f59e0b' }} />
                    Top Performing Branches
                  </Space>
                }
              >
                <div style={{ marginBottom: '24px' }}>
                  {topPerformers.map((performer, index) => (
                    <div key={index} style={{ marginBottom: '20px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <span style={{ fontWeight: '600' }}>{performer.name}</span>
                        <Tag color={index === 0 ? 'gold' : index === 1 ? 'blue' : 'green'} className="custom-tag">
                          {performer.bookings} bookings
                        </Tag>
                      </div>
                      <Progress 
                        percent={performer.score} 
                        size="small"
                        strokeColor={index === 0 ? '#f59e0b' : index === 1 ? '#3b82f6' : '#10b981'}
                      />
                    </div>
                  ))}
                </div>
                
                <Button type="primary" ghost block icon={<RiseOutlined />}>
                  View Performance Report
                </Button>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  )
}


