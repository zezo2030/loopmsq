import { Row, Col, Card, Statistic, List, Avatar, Button, Space, Tag, Divider, Image } from 'antd'
import {
  CalendarOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  BarChartOutlined,
  RightOutlined
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
    ; (async () => {
      try {
        const branchIdParam = me?.branchId ? `?branchId=${me.branchId}` : ''
        const ov = await apiGet<any>(`/reports/overview${branchIdParam}`)
        setOverview(ov)
      } catch { }
      try {
        const res = await apiGet<any>('/bookings/branch/me?page=1&limit=8')
        const items = Array.isArray(res?.bookings) ? res.bookings : (res?.items || [])
        setRecent(items)
      } catch { }
      try {
        if (me?.branchId) {
          const branch = await apiGet(`/content/branches/${me.branchId}`)
          setBranchData(branch)
        }
      } catch { }
    })()
  }, [me?.branchId])

  const revenueEntries = Object.entries(overview?.revenueByMethod || {})

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'success'
      case 'pending': return 'warning'
      case 'cancelled': return 'error'
      case 'completed': return 'processing'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return t('bookings.status_confirmed') || 'مؤكد'
      case 'pending': return t('bookings.status_pending') || 'معلق'
      case 'cancelled': return t('bookings.status_cancelled') || 'ملغي'
      case 'completed': return t('bookings.status_completed') || 'مكتمل'
      default: return status
    }
  }

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      {/* Branch Cover Image */}
      {branchData?.coverImage && (
        <Card
          style={{
            marginBottom: 24,
            padding: 0,
            overflow: 'hidden',
            borderRadius: 8,
            border: '1px solid #e2e8f0'
          }}
          bodyStyle={{ padding: 0 }}
        >
          <Image
            src={branchData.coverImage}
            alt="Branch Cover"
            style={{ width: '100%', height: 180, objectFit: 'cover' }}
            preview={false}
          />
        </Card>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">{t('dashboard.title') || 'نظرة عامة على الفرع'}</h1>
            <p className="page-subtitle">{t('dashboard.subtitle') || 'راقب أداء فرعك والمؤشرات الرئيسية'}</p>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={() => (window.location.href = '/bookings')}
              style={{
                height: 40,
                borderRadius: 6,
                fontWeight: 600,
                background: '#1a365d',
                border: 'none'
              }}
            >
              {t('dashboard.go_bookings') || 'الانتقال إلى الحجوزات'}
            </Button>
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Main Stats Cards */}
          <Row gutter={[20, 20]} style={{ marginBottom: '28px' }}>
            {/* Total Bookings */}
            <Col xs={24} sm={12} md={6}>
              <Card
                style={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
                bodyStyle={{ padding: 24 }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: 'rgba(26, 54, 93, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16
                }}>
                  <CalendarOutlined style={{ fontSize: 22, color: '#1a365d' }} />
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#1a202c', marginBottom: 4 }}>
                  {overview?.bookings?.total ?? 0}
                </div>
                <div style={{ fontSize: 14, color: '#4a5568', fontWeight: 500 }}>
                  {t('reports.bookings_total') || 'إجمالي الحجوزات'}
                </div>
              </Card>
            </Col>

            {/* Confirmed Bookings */}
            <Col xs={24} sm={12} md={6}>
              <Card
                style={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
                bodyStyle={{ padding: 24 }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: 'rgba(39, 103, 73, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16
                }}>
                  <CheckCircleOutlined style={{ fontSize: 22, color: '#276749' }} />
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#1a202c', marginBottom: 4 }}>
                  {overview?.bookings?.confirmed ?? 0}
                </div>
                <div style={{ fontSize: 14, color: '#4a5568', fontWeight: 500 }}>
                  {t('reports.bookings_confirmed') || 'الحجوزات المؤكدة'}
                </div>
              </Card>
            </Col>

            {/* Cancelled Bookings */}
            <Col xs={24} sm={12} md={6}>
              <Card
                style={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
                bodyStyle={{ padding: 24 }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: 'rgba(197, 48, 48, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16
                }}>
                  <CloseCircleOutlined style={{ fontSize: 22, color: '#c53030' }} />
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#1a202c', marginBottom: 4 }}>
                  {overview?.bookings?.cancelled ?? 0}
                </div>
                <div style={{ fontSize: 14, color: '#4a5568', fontWeight: 500 }}>
                  {t('reports.bookings_cancelled') || 'الحجوزات الملغية'}
                </div>
              </Card>
            </Col>

            {/* Revenue */}
            <Col xs={24} sm={12} md={6}>
              <Card
                style={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
                bodyStyle={{ padding: 24 }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  background: 'rgba(43, 108, 176, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16
                }}>
                  <DollarOutlined style={{ fontSize: 22, color: '#2b6cb0' }} />
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#1a202c', marginBottom: 4 }}>
                  {Object.values(overview?.revenueByMethod || {}).reduce((a: number, b: any) => a + Number(b || 0), 0)}
                  <span style={{ fontSize: 16, fontWeight: 500, marginRight: 6 }}>SAR</span>
                </div>
                <div style={{ fontSize: 14, color: '#4a5568', fontWeight: 500 }}>
                  {t('dashboard.kpi_revenue') || 'الإيرادات'}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Revenue by Method */}
          {revenueEntries.length > 0 && (
            <Row gutter={[20, 20]} style={{ marginBottom: '28px' }}>
              {revenueEntries.map(([k, v]) => (
                <Col xs={24} sm={12} md={6} key={k}>
                  <Card
                    style={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}
                    bodyStyle={{ padding: 20 }}
                  >
                    <Statistic
                      title={<span style={{ color: '#4a5568', fontSize: 13 }}>{`${t('reports.revenue_by_method') || 'الإيرادات'}: ${k}`}</span>}
                      value={Number(v)}
                      suffix="SAR"
                      valueStyle={{ fontSize: 24, fontWeight: 600, color: '#1a202c' }}
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          <Row gutter={[24, 24]}>
            {/* Recent Activity */}
            <Col xs={24} lg={16}>
              <Card
                style={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
                title={
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#1a202c' }}>
                    {t('dashboard.recent_activity') || 'آخر الأنشطة'}
                  </span>
                }
                extra={
                  <Button
                    type="link"
                    onClick={() => (window.location.href = '/bookings')}
                    style={{ fontWeight: 500, color: '#2b6cb0' }}
                  >
                    {t('common.view_all') || 'عرض الكل'} <RightOutlined style={{ fontSize: 10 }} />
                  </Button>
                }
              >
                <List
                  style={{ maxHeight: 400, overflowY: 'auto' }}
                  itemLayout="horizontal"
                  dataSource={recent}
                  locale={{ emptyText: 'لا توجد حجوزات حديثة' }}
                  renderItem={(item: any) => (
                    <List.Item style={{ padding: '14px 0', borderBottom: '1px solid #edf2f7' }}>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            size={44}
                            style={{
                              backgroundColor: 'rgba(26, 54, 93, 0.1)',
                              color: '#1a365d',
                              fontSize: 18
                            }}
                          >
                            📅
                          </Avatar>
                        }
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: '#1a202c', fontSize: 14 }}>
                              {`${t('dashboard.booking') || 'حجز'} #${String(item.id).slice(0, 8)}...`}
                            </span>
                            <Tag color={getStatusColor(item.status)} style={{ borderRadius: 4, fontWeight: 500 }}>
                              {getStatusText(item.status)}
                            </Tag>
                          </div>
                        }
                        description={
                          <div>
                            <div style={{ marginBottom: 4, color: '#4a5568', fontSize: 13 }}>
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
                            <span style={{ color: '#718096', fontSize: 12 }}>
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

            {/* Status Summary */}
            <Col xs={24} lg={8}>
              <Card
                style={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
                title={
                  <Space>
                    <CheckCircleOutlined style={{ color: '#276749' }} />
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#1a202c' }}>
                      {t('dashboard.status_summary') || 'ملخص الحالة'}
                    </span>
                  </Space>
                }
              >
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  {/* Today's Bookings */}
                  <div style={{
                    padding: '16px 20px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: 8,
                    border: '1px solid #86efac'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#166534', fontSize: 14 }}>
                          {t('dashboard.todays_events') || 'فعاليات اليوم'}
                        </div>
                        <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 2 }}>
                          {t('dashboard.active_bookings') || 'الحجوزات النشطة'}
                        </div>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#15803d' }}>
                        {overview?.bookings?.total || 0}
                      </div>
                    </div>
                  </div>

                  {/* Revenue This Week */}
                  <div style={{
                    padding: '16px 20px',
                    backgroundColor: '#eff6ff',
                    borderRadius: 8,
                    border: '1px solid #93c5fd'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e40af', fontSize: 14 }}>
                          {t('dashboard.this_week') || 'هذا الأسبوع'}
                        </div>
                        <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 2 }}>
                          {t('dashboard.revenue') || 'الإيرادات'}
                        </div>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1d4ed8' }}>
                        {Object.values(overview?.revenueByMethod || {}).reduce((a: number, b: any) => a + Number(b || 0), 0)} <span style={{ fontSize: 14, fontWeight: 500 }}>SAR</span>
                      </div>
                    </div>
                  </div>
                </Space>

                <Divider style={{ margin: '20px 0' }} />

                <Space style={{ width: '100%', justifyContent: 'center' }} size={12}>
                  <Button
                    icon={<FileTextOutlined />}
                    size="middle"
                    onClick={() => (window.location.href = '/reports')}
                    style={{
                      borderRadius: 6,
                      fontWeight: 500,
                      border: '1px solid #1a365d',
                      color: '#1a365d'
                    }}
                  >
                    {t('dashboard.view_reports') || 'عرض التقارير'}
                  </Button>
                  <Button
                    icon={<BarChartOutlined />}
                    size="middle"
                    style={{
                      borderRadius: 6,
                      fontWeight: 500,
                      border: '1px solid #e2e8f0',
                      color: '#4a5568'
                    }}
                  >
                    {t('dashboard.analytics') || 'التحليلات'}
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>

          {/* Branch Images Gallery */}
          {branchData?.images && branchData.images.length > 0 && (
            <Row gutter={[24, 24]} style={{ marginTop: 28 }}>
              <Col xs={24}>
                <Card
                  style={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                  }}
                  title={
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#1a202c' }}>
                      {t('branch.images') || 'صور الفرع'}
                    </span>
                  }
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
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
