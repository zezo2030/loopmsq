import { Row, Col, Card, Statistic, List, Avatar, Button, Space, Tag, Divider } from 'antd'
import { 
  CalendarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import '../theme.css'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../api'

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [overviewAll, setOverviewAll] = useState<{ bookings: { total: number; confirmed: number; cancelled: number }; scans: number; revenueByMethod: Record<string, number> } | null>(null)
  const [todaysEventsCount, setTodaysEventsCount] = useState<number>(0)
  const [weekRevenue, setWeekRevenue] = useState<number>(0)
  const [pendingApprovals, setPendingApprovals] = useState<number>(0)

  useEffect(() => {
    ;(async () => {
      try {
        const ovAll = await apiGet<any>('/reports/overview')
        setOverviewAll(ovAll)
      } catch {}
      try {
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
        const res = await apiGet<any>(`/bookings/admin/all?from=${encodeURIComponent(startOfDay)}&to=${encodeURIComponent(endOfDay)}&limit=200`)
        const items = Array.isArray(res?.bookings) ? res.bookings : (res?.items || [])
        setTodaysEventsCount(items.length || 0)
      } catch {}
      try {
        const end = new Date()
        const start = new Date(end)
        start.setDate(end.getDate() - 7)
        const ovWeek = await apiGet<any>(`/reports/overview?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`)
        const revTotal = Object.values(ovWeek?.revenueByMethod || {}).reduce((a: number, b: any) => a + Number(b || 0), 0)
        setWeekRevenue(revTotal)
      } catch {}
      try {
        const resPending = await apiGet<any>('/bookings/admin/all?status=pending&limit=200')
        const itemsPending = Array.isArray(resPending?.bookings) ? resPending.bookings : (resPending?.items || [])
        setPendingApprovals(itemsPending.length || 0)
      } catch {}
    })()
  }, [])
  const [overview, setOverview] = useState<{ bookings: { total: number; confirmed: number; cancelled: number; pending?: number }; scans: number; revenueByMethod: Record<string, number> } | null>(null)
  const [recent, setRecent] = useState<Array<{ id: string; branch?: any; hall?: any; startTime?: string; status?: string }>>([])

  useEffect(() => {
    ;(async () => {
      try {
        const ov = await apiGet<any>('/reports/overview')
        setOverview(ov)
      } catch {}
      try {
        const res = await apiGet<any>('/bookings/admin/all?page=1&limit=8')
        const displayName = (o?: any) => o?.name ?? o?.name_ar ?? o?.nameAr ?? o?.name_en ?? o?.nameEn ?? ''
        const items = Array.isArray(res?.bookings) ? res.bookings : (res?.items || [])
        const normalized = items.map((b: any) => ({
          ...b,
          branch: b.branch ? { ...b.branch, name: displayName(b.branch) } : b.branch,
          hall: b.hall ? { ...b.hall, name: displayName(b.hall) } : b.hall,
        }))
        setRecent(normalized)
      } catch {}
    })()
  }, [])

  const revenueEntries = Object.entries(overview?.revenueByMethod || {})

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">{t('dashboard.title') || 'Dashboard Overview'}</h1>
            <p className="page-subtitle">{t('dashboard.subtitle') || 'Monitor your business performance and key metrics'}</p>
          </div>
          <Space>
            <Button type="primary" className="btn-primary" icon={<CalendarOutlined />} onClick={() => navigate('/admin/bookings')}>
              {t('dashboard.go_bookings') || 'Go to Bookings'}
            </Button>
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Main Stats Cards */}
          <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
            {[{
              title: t('reports.bookings_total') || 'Bookings (Total)',
              value: overviewAll?.bookings?.total ?? 0,
              prefix: <CalendarOutlined />,
              suffix: t('dashboard.kpi_bookings') || 'bookings',
              change: 0,
              trend: 'stable'
            }, {
              title: t('reports.bookings_confirmed') || 'Bookings (Confirmed)',
              value: overviewAll?.bookings?.confirmed ?? 0,
              prefix: <CheckCircleOutlined />,
              suffix: '',
              change: 0,
              trend: 'stable'
            }, {
              title: t('reports.bookings_cancelled') || 'Bookings (Cancelled)',
              value: overviewAll?.bookings?.cancelled ?? 0,
              prefix: <ArrowDownOutlined />,
              suffix: '',
              change: 0,
              trend: 'stable'
            }, {
              title: t('dashboard.kpi_revenue') || 'Revenue',
              value: Object.values(overviewAll?.revenueByMethod || {}).reduce((a: number, b: any) => a + Number(b || 0), 0),
              prefix: <DollarOutlined />,
              suffix: 'SAR',
              change: 0,
              trend: 'stable'
            }].map((stat, index) => (
              <Col xs={24} sm={12} md={8} lg={6} key={index}>
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

          {/* Revenue by Method */}
          {revenueEntries.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
              {revenueEntries.map(([k, v]) => (
                <Col xs={24} sm={12} md={8} lg={6} key={k}>
                  <Card className="custom-card">
                    <Statistic title={`${t('reports.revenue_by_method') || 'Revenue'}: ${k}`} value={Number(v)} suffix="SAR" />
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          <Row gutter={[24, 24]}>
            {/* Recent Activity */}
            <Col xs={24} md={16} lg={16}>
              <Card 
                className="custom-card"
                title={t('dashboard.recent_activity') || 'Recent Activity'} 
                extra={<Button type="link">{t('common.view_all') || 'View All'}</Button>}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={recent}
                  renderItem={(item: any) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar 
                            size={40}
                            style={{ 
                              backgroundColor: '#dbeafe',
                              fontSize: '18px' 
                            }}
                          >
                            📅
                          </Avatar>
                        }
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '600' }}>{`${t('dashboard.booking') || 'Booking'} #${String(item.id).slice(0,8)}...`}</span>
                            <Tag 
                              color={'blue'}
                            >
                              {item.status || ''}
                            </Tag>
                          </div>
                        }
                        description={
                          <div>
                            <div style={{ marginBottom: '4px' }}>{`${item.branch?.name || ''}${item.hall?.name ? ' - ' + item.hall.name : ''}`}</div>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>
                              {item.startTime ? new Date(item.startTime).toLocaleString() : ''}
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
            <Col xs={24} md={8} lg={8}>
              <Card 
                className="custom-card"
                title={
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    {t('dashboard.status_summary') || 'Status Summary'}
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
                        <div style={{ fontWeight: '600', color: '#d46b08' }}>{t('dashboard.pending_approvals') || 'Pending Approvals'}</div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{t('dashboard.school_trips_events') || 'School trips & events'}</div>
                      </div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 'bold',
                        color: '#d46b08'
                      }}>
                        {pendingApprovals}
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
                        <div style={{ fontWeight: '600', color: '#389e0d' }}>{t('dashboard.todays_events') || "Today's Events"}</div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{t('dashboard.active_bookings') || 'Active bookings'}</div>
                      </div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: 'bold',
                        color: '#389e0d'
                      }}>
                        {todaysEventsCount}
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
                        <div style={{ fontWeight: '600', color: '#0958d9' }}>{t('dashboard.this_week') || 'This Week'}</div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{t('dashboard.revenue') || 'Revenue'}</div>
                      </div>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: 'bold',
                        color: '#0958d9'
                      }}>
                        {weekRevenue} SAR
                      </div>
                    </div>
                  </div>
                </Space>
                
                <Divider />
                
                <Space style={{ width: '100%', justifyContent: 'center' }}>
                  <Tag color="blue">{t('dashboard.keep_tracking') || 'Keep tracking your metrics'}</Tag>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  )
}


