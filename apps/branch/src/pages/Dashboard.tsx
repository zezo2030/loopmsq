import { Row, Col, Card, Statistic, List, Avatar, Button, Space, Tag, Divider, Image } from 'antd'
import { 
  CalendarOutlined,
  RiseOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import '../theme.css'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { apiGet } from '../api'
import { useBranchAuth } from '../auth'

export default function Dashboard() {
  const { t } = useTranslation()
  const { me } = useBranchAuth()
  const [overview, setOverview] = useState<{ 
    bookings: { total: number; confirmed: number; cancelled: number; pending?: number }; 
    scans: number; 
    revenueByMethod: Record<string, number> 
  } | null>(null)
  const [recent, setRecent] = useState<Array<{ 
    id: string; 
    branch?: any; 
    hall?: any; 
    startTime?: string; 
    status?: string 
  }>>([])
  const [branchData, setBranchData] = useState<any>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const branchIdParam = me?.branchId ? `?branchId=${me.branchId}` : ''
        const ov = await apiGet<any>(`/reports/overview${branchIdParam}`)
        setOverview(ov)
      } catch {}
      try {
        const res = await apiGet<any>('/bookings/branch/me?page=1&limit=8')
        const items = Array.isArray(res?.bookings) ? res.bookings : (res?.items || [])
        setRecent(items)
      } catch {}
      try {
        if (me?.branchId) {
          const branch = await apiGet(`/content/branches/${me.branchId}`)
          setBranchData(branch)
        }
      } catch {}
    })()
  }, [me?.branchId])

  const revenueEntries = Object.entries(overview?.revenueByMethod || {})

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      {/* Branch Cover Image */}
      {branchData?.coverImage && (
        <Card style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
          <Image
            src={branchData.coverImage}
            alt="Branch Cover"
            style={{ width: '100%', height: '200px', objectFit: 'cover' }}
            preview={false}
          />
        </Card>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">{t('dashboard.title') || 'Branch Overview'}</h1>
            <p className="page-subtitle">{t('dashboard.subtitle') || 'Monitor your branch performance and key metrics'}</p>
          </div>
          <Space>
            <Button type="primary" className="btn-primary" icon={<CalendarOutlined />} onClick={() => (window.location.href = '/bookings')}>
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
              value: overview?.bookings?.total ?? 0,
              prefix: <CalendarOutlined />,
              suffix: t('dashboard.kpi_bookings') || 'bookings',
              change: 0,
              trend: 'stable'
            }, {
              title: t('reports.bookings_confirmed') || 'Bookings (Confirmed)',
              value: overview?.bookings?.confirmed ?? 0,
              prefix: <CheckCircleOutlined />,
              suffix: '',
              change: 0,
              trend: 'stable'
            }, {
              title: t('reports.bookings_cancelled') || 'Bookings (Cancelled)',
              value: overview?.bookings?.cancelled ?? 0,
              prefix: <ArrowDownOutlined />,
              suffix: '',
              change: 0,
              trend: 'stable'
            }, {
              title: t('dashboard.kpi_revenue') || 'Revenue',
              value: Object.values(overview?.revenueByMethod || {}).reduce((a: number, b: any) => a + Number(b || 0), 0),
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
                        {t('dashboard.no_change') || 'No change from last month'}
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
                  style={{ maxHeight: '400px', overflowY: 'auto' }}
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
                            <div style={{ marginBottom: '4px' }}>
                              {(() => {
                                const branchName = item.branch?.name || item.branch?.name_ar || item.branch?.nameAr || item.branch?.name_en || item.branch?.nameEn || '';
                                const hallName = item.hall?.name || item.hall?.name_ar || item.hall?.nameAr || item.hall?.name_en || item.hall?.nameEn || '';
                                if (branchName && hallName) {
                                  return `${branchName} - ${hallName}`;
                                } else if (branchName) {
                                  return branchName;
                                } else if (hallName) {
                                  return hallName;
                                }
                                return 'غير محدد';
                              })()}
                            </div>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>
                              {item.startTime ? new Date(item.startTime).toLocaleString('ar-SA', { calendar: 'gregory' }) : ''}
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
                        {overview?.bookings?.total || 0}
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
                        {Object.values(overview?.revenueByMethod || {}).reduce((a: number, b: any) => a + Number(b || 0), 0)} SAR
                      </div>
                    </div>
                  </div>
                </Space>
                
                <Divider />
                
                <Space style={{ width: '100%', justifyContent: 'center' }}>
                  <Button type="primary" ghost icon={<FileTextOutlined />} size="small">
                    {t('dashboard.view_reports') || 'View Reports'}
                  </Button>
                  <Button type="default" icon={<RiseOutlined />} size="small">
                    {t('dashboard.analytics') || 'Analytics'}
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>

          {/* Branch Images Gallery */}
          {branchData?.images && branchData.images.length > 0 && (
            <Row gutter={[24, 24]} style={{ marginTop: '32px' }}>
              <Col xs={24}>
                <Card className="custom-card" title={t('branch.images') || 'Branch Images'}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {branchData.images.map((imageUrl: string, index: number) => (
                      <Image
                        key={index}
                        src={imageUrl}
                        alt={`Branch Image ${index + 1}`}
                        style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8 }}
                        preview={{
                          mask: <div style={{ color: 'white' }}>معاينة</div>
                        }}
                      />
                    ))}
                  </div>
                </Card>
              </Col>
            </Row>
          )}
        </div>
      </div>
    </div>
  )
}
