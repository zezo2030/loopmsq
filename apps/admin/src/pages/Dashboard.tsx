import { Row, Col, Card, Statistic, Progress, List, Avatar, Button, Space, Tag, Divider } from 'antd'
import { 
  UserOutlined, 
  TeamOutlined, 
  ShopOutlined, 
  CalendarOutlined,
  TrophyOutlined,
  RiseOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  BookOutlined,
  GiftOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined
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
      title: 'Total Bookings',
      value: 156,
      prefix: <CalendarOutlined />,
      suffix: 'bookings',
      change: 18.2,
      trend: 'up'
    },
    {
      title: 'Monthly Revenue',
      value: 285000,
      prefix: <DollarOutlined />,
      suffix: 'SAR',
      change: 15.3,
      trend: 'up'
    }
  ]

  const bookingStats = [
    {
      title: 'Hall Bookings',
      value: 98,
      prefix: <CalendarOutlined />,
      color: '#1890ff'
    },
    {
      title: 'School Trips',
      value: 24,
      prefix: <BookOutlined />,
      color: '#52c41a'
    },
    {
      title: 'Special Events',
      value: 18,
      prefix: <GiftOutlined />,
      color: '#722ed1'
    }
  ]

  const recentActivities = [
    {
      title: 'حجز جديد مؤكد',
      description: 'قاعة الماسة - حفل عيد ميلاد لـ 30 شخص',
      avatar: '📅',
      time: 'منذ 5 دقائق',
      type: 'booking'
    },
    {
      title: 'طلب رحلة مدرسية',
      description: 'مدرسة النور - 45 طالب للرحلة التعليمية',
      avatar: '📚',
      time: 'منذ 15 دقيقة',
      type: 'trip'
    },
    {
      title: 'عرض سعر مرسل',
      description: 'حدث خاص - حفل تخرج جامعي',
      avatar: '🎉',
      time: 'منذ 30 دقيقة',
      type: 'event'
    },
    {
      title: 'دفعة مستلمة',
      description: 'تم استلام 3,500 ر.س لحجز القاعة',
      avatar: '💰',
      time: 'منذ ساعة',
      type: 'payment'
    },
    {
      title: 'مستخدم جديد',
      description: 'أحمد محمد انضم للمنصة',
      avatar: '👤',
      time: 'منذ ساعتين',
      type: 'user'
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
          {/* Main Stats Cards */}
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

          {/* Bookings Breakdown */}
          <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
            <Col xs={24}>
              <Card 
                className="custom-card"
                title="Bookings Overview" 
                extra={<Button type="link">View All Bookings</Button>}
              >
                <Row gutter={[16, 16]}>
                  {bookingStats.map((stat, index) => (
                    <Col xs={24} sm={8} key={index}>
                      <div style={{ 
                        textAlign: 'center',
                        padding: '20px',
                        backgroundColor: '#fafafa',
                        borderRadius: '8px',
                        border: `2px solid ${stat.color}20`
                      }}>
                        <div style={{ 
                          fontSize: '32px', 
                          color: stat.color,
                          marginBottom: '8px'
                        }}>
                          {stat.prefix}
                        </div>
                        <div style={{ 
                          fontSize: '24px', 
                          fontWeight: 'bold',
                          color: stat.color,
                          marginBottom: '4px'
                        }}>
                          {stat.value}
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          color: '#8c8c8c',
                          fontWeight: '500'
                        }}>
                          {stat.title}
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>
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
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar 
                            size={40}
                            style={{ 
                              backgroundColor: 
                                item.type === 'booking' ? '#dbeafe' :
                                item.type === 'trip' ? '#dcfce7' :
                                item.type === 'event' ? '#faf5ff' :
                                item.type === 'payment' ? '#fefce8' :
                                '#f1f5f9',
                              fontSize: '18px' 
                            }}
                          >
                            {item.avatar}
                          </Avatar>
                        }
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '600' }}>{item.title}</span>
                            <Tag 
                              color={
                                item.type === 'booking' ? 'blue' :
                                item.type === 'trip' ? 'green' :
                                item.type === 'event' ? 'purple' :
                                item.type === 'payment' ? 'gold' :
                                'default'
                              }
                              size="small"
                            >
                              {item.type === 'booking' && 'حجز'}
                              {item.type === 'trip' && 'رحلة'}
                              {item.type === 'event' && 'حدث'}
                              {item.type === 'payment' && 'دفع'}
                              {item.type === 'user' && 'مستخدم'}
                            </Tag>
                          </div>
                        }
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

            {/* Quick Actions & Status Summary */}
            <Col xs={24} lg={8}>
              <Card 
                className="custom-card"
                title={
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    Status Summary
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {/* Pending Items */}
                  <div style={{ 
                    padding: '16px',
                    backgroundColor: '#fff7e6',
                    borderRadius: '8px',
                    border: '1px solid #ffd591'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#d46b08' }}>Pending Approvals</div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>School trips & events</div>
                      </div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 'bold',
                        color: '#d46b08'
                      }}>
                        8
                      </div>
                    </div>
                  </div>

                  {/* Today's Bookings */}
                  <div style={{ 
                    padding: '16px',
                    backgroundColor: '#f6ffed',
                    borderRadius: '8px',
                    border: '1px solid #b7eb8f'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#389e0d' }}>Today's Events</div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Active bookings</div>
                      </div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 'bold',
                        color: '#389e0d'
                      }}>
                        12
                      </div>
                    </div>
                  </div>

                  {/* Revenue This Week */}
                  <div style={{ 
                    padding: '16px',
                    backgroundColor: '#e6f7ff',
                    borderRadius: '8px',
                    border: '1px solid #91d5ff'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#0958d9' }}>This Week</div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Revenue</div>
                      </div>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: 'bold',
                        color: '#0958d9'
                      }}>
                        67,500 SAR
                      </div>
                    </div>
                  </div>
                </Space>
                
                <Divider />
                
                <Space style={{ width: '100%', justifyContent: 'center' }}>
                  <Button type="primary" ghost icon={<FileTextOutlined />} size="small">
                    View Reports
                  </Button>
                  <Button type="default" icon={<RiseOutlined />} size="small">
                    Analytics
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  )
}


