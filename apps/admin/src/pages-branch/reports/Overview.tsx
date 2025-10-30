import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Button, Space, message, Table, Tag } from 'antd'
import { DownloadOutlined, CalendarOutlined, DollarOutlined, BarChartOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiGet } from '../../shared/api'
import { useAuth } from '../../shared/auth'

const { RangePicker } = DatePicker

export default function Overview() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const [dateRange, setDateRange] = useState<any>(null)
  const [overview, setOverview] = useState<any>(null)
  const [recentBookings, setRecentBookings] = useState<any[]>([])

  useEffect(() => {
    // Initialize default date range to last 30 days for better visibility
    if (!dateRange) {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 30)
      setDateRange([from, to])
      return
    }
    loadOverview()
    loadRecentBookings()
  }, [dateRange])

  const loadOverview = async () => {
    if (!me?.branchId) return
    
    try {
      const params = new URLSearchParams({
        branchId: me.branchId,
      })

      if (dateRange) {
        params.append('from', dateRange[0].toISOString())
        params.append('to', dateRange[1].toISOString())
      }

      const data: any = await apiGet(`/reports/overview?${params.toString()}`)
      setOverview(data)
    } catch (error) {
      message.error(t('reports.load_failed') || 'Failed to load reports')
    }
  }

  const loadRecentBookings = async () => {
    if (!me?.branchId) return
    
    try {
      const data: any = await apiGet(`/bookings/branch/me?page=1&limit=5`)
      const items = Array.isArray(data) ? data : (data?.bookings || [])
      setRecentBookings(items)
    } catch (error) {
      // Silent fail for recent bookings
    }
  }

  const handleExportCSV = async () => {
    if (!me?.branchId) return
    try {
      const params = new URLSearchParams({
        type: 'overview',
        branchId: me.branchId,
      })
      if (dateRange) {
        params.append('from', dateRange[0].toISOString())
        params.append('to', dateRange[1].toISOString())
      }
      const base = (import.meta as any).env?.VITE_API_BASE || (window as any).NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api/v1'
      const response = await fetch(`${base}/reports/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `branch-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      message.success(t('reports.exported') || 'Report exported successfully')
    } catch (error) {
      message.error(t('reports.export_failed') || 'Failed to export report')
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'orange',
      confirmed: 'green',
      cancelled: 'red',
      completed: 'blue',
    }
    return colors[status] || 'default'
  }

  const recentBookingsColumns = [
    {
      title: t('bookings.id') || 'Booking ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => `#${id.slice(0, 8)}...`,
    },
    {
      title: t('bookings.user') || 'User',
      key: 'user',
      render: (record: any) => record.user?.name || t('bookings.unnamed_user') || 'Unnamed User',
    },
    {
      title: t('bookings.hall') || 'Hall',
      key: 'hall',
      render: (record: any) => record.hall?.nameAr || record.hall?.nameEn || '-',
    },
    {
      title: t('bookings.amount') || 'Amount',
      key: 'amount',
      render: (record: any) => `${record.amount || 0} SAR`,
    },
    {
      title: t('bookings.status') || 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {t(`bookings.status_${status}`) || status}
        </Tag>
      ),
    },
  ]

  const stats = [
    {
      title: t('reports.bookings_total') || 'Total Bookings',
      value: overview?.bookings?.total || 0,
      icon: <CalendarOutlined />,
      color: '#3b82f6',
    },
    {
      title: t('reports.bookings_confirmed') || 'Confirmed',
      value: overview?.bookings?.confirmed || 0,
      icon: <BarChartOutlined />,
      color: '#10b981',
    },
    {
      title: t('reports.bookings_cancelled') || 'Cancelled',
      value: overview?.bookings?.cancelled || 0,
      icon: <BarChartOutlined />,
      color: '#ef4444',
    },
    {
      title: t('reports.scans') || 'Scans',
      value: overview?.scans || 0,
      icon: <BarChartOutlined />,
      color: '#8b5cf6',
    },
  ]

  const revenueStats = Object.entries(overview?.revenueByMethod || {}).map(([method, amount]) => ({
    title: `${t('reports.revenue_by_method') || 'Revenue'}: ${method}`,
    value: Number(amount),
    icon: <DollarOutlined />,
    color: '#10b981',
  }))

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">{t('reports.overview') || 'Reports Overview'}</h1>
            <p className="page-subtitle">{t('reports.subtitle') || 'Analyze your branch performance and generate reports'}</p>
          </div>
          <Space>
            <RangePicker 
              onChange={setDateRange}
              style={{ width: '300px' }}
            />
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={handleExportCSV}
              className="btn-primary"
            >
              {t('reports.export_csv') || 'Export CSV'}
            </Button>
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Main Statistics */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            {stats.map((stat, index) => (
              <Col xs={12} sm={6} key={index}>
                <Card className="custom-card">
                  <Statistic
                    title={stat.title}
                    value={stat.value}
                    prefix={stat.icon}
                    valueStyle={{ 
                      color: stat.color, 
                      fontSize: '24px', 
                      fontWeight: 'bold' 
                    }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Revenue by Method */}
          {revenueStats.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              {revenueStats.map((stat, index) => (
                <Col xs={12} sm={6} key={index}>
                  <Card className="custom-card">
                    <Statistic
                      title={stat.title}
                      value={stat.value}
                      prefix={stat.icon}
                      suffix="SAR"
                      valueStyle={{ 
                        color: stat.color, 
                        fontSize: '20px', 
                        fontWeight: 'bold' 
                      }}
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          <Row gutter={[24, 24]}>
            {/* Revenue Summary */}
            <Col xs={24} lg={12}>
              <Card className="custom-card" title={t('reports.revenue_summary') || 'Revenue Summary'}>
                <Row gutter={[16, 16]}>
                  <Col xs={12}>
                    <Statistic
                      title={t('reports.total_revenue') || 'Total Revenue'}
                      value={Object.values(overview?.revenueByMethod || {}).reduce((a: number, b: any) => a + Number(b || 0), 0)}
                      suffix="SAR"
                      valueStyle={{ fontSize: '20px', color: '#10b981', fontWeight: 'bold' }}
                    />
                  </Col>
                  <Col xs={12}>
                    <Statistic
                      title={t('reports.average_booking') || 'Average Booking'}
                      value={overview?.bookings?.total > 0 
                        ? Math.round(Object.values(overview?.revenueByMethod || {}).reduce((a: number, b: any) => a + Number(b || 0), 0) / overview.bookings.total)
                        : 0
                      }
                      suffix="SAR"
                      valueStyle={{ fontSize: '20px', color: '#3b82f6', fontWeight: 'bold' }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Recent Bookings */}
            <Col xs={24} lg={12}>
              <Card 
                className="custom-card" 
                title={t('reports.recent_bookings') || 'Recent Bookings'}
                extra={<Button type="link" onClick={() => window.location.href = '/branch/bookings'}>
                  {t('common.view_all') || 'View All'}
                </Button>}
              >
                <Table
                  columns={recentBookingsColumns}
                  dataSource={recentBookings}
                  pagination={false}
                  size="small"
                  className="custom-table"
                />
              </Card>
            </Col>
          </Row>

          {/* Performance Metrics */}
          <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
            <Col xs={24}>
              <Card className="custom-card" title={t('reports.performance_metrics') || 'Performance Metrics'}>
                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title={t('reports.confirmation_rate') || 'Confirmation Rate'}
                      value={overview?.bookings?.total > 0 
                        ? Math.round((overview.bookings.confirmed / overview.bookings.total) * 100)
                        : 0
                      }
                      suffix="%"
                      valueStyle={{ fontSize: '18px', color: '#10b981' }}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title={t('reports.cancellation_rate') || 'Cancellation Rate'}
                      value={overview?.bookings?.total > 0 
                        ? Math.round((overview.bookings.cancelled / overview.bookings.total) * 100)
                        : 0
                      }
                      suffix="%"
                      valueStyle={{ fontSize: '18px', color: '#ef4444' }}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title={t('reports.scan_rate') || 'Scan Rate'}
                      value={overview?.bookings?.confirmed > 0 
                        ? Math.round((overview.scans / overview.bookings.confirmed) * 100)
                        : 0
                      }
                      suffix="%"
                      valueStyle={{ fontSize: '18px', color: '#8b5cf6' }}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title={t('reports.utilization') || 'Utilization'}
                      value={overview?.bookings?.total > 0 
                        ? Math.round((overview.bookings.confirmed / overview.bookings.total) * 100)
                        : 0
                      }
                      suffix="%"
                      valueStyle={{ fontSize: '18px', color: '#3b82f6' }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  )
}


