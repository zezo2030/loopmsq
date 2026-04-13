import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { CalendarOutlined, CreditCardOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { apiGet } from '../../api'

const { RangePicker } = DatePicker
const { Text, Title } = Typography

type SubscriptionRow = {
  id: string
  status: 'active' | 'depleted' | 'expired' | 'cancelled'
  paymentStatus: 'pending' | 'completed' | 'failed'
  totalHours: number | null
  remainingHours: number | null
  dailyHoursLimit: number | null
  startedAt: string
  endsAt: string
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; phone: string; email: string }
  branch: { id: string; name: string }
  plan: { id: string; title: string; usageMode: string; durationMonths: number | null; price: number; currency: string }
}

type ResponseShape = {
  subscriptions: SubscriptionRow[]
  stats: {
    total: number
    active: number
    expired: number
    depleted: number
    paid: number
    revenue: number
  }
}

export default function SubscriptionsList() {
  const [rows, setRows] = useState<SubscriptionRow[]>([])
  const [stats, setStats] = useState<ResponseShape['stats']>({
    total: 0,
    active: 0,
    expired: 0,
    depleted: 0,
    paid: 0,
    revenue: 0,
  })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | undefined>()
  const [paymentStatus, setPaymentStatus] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<any>(null)
  const navigate = useNavigate()

  const formatCurrency = (value: number, currency = 'SAR') =>
    `${new Intl.NumberFormat('ar-SA').format(value || 0)} ${currency}`

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString('ar-SA') : '-'

  const loadRows = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', limit: '100' })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      if (paymentStatus) params.set('paymentStatus', paymentStatus)
      if (dateRange?.[0] && dateRange?.[1]) {
        params.set('from', dateRange[0].toISOString())
        params.set('to', dateRange[1].toISOString())
      }

      const data = await apiGet<ResponseShape>(`/subscription-purchases/branch/me?${params.toString()}`)
      setRows(data.subscriptions || [])
      setStats(data.stats || { total: 0, active: 0, expired: 0, depleted: 0, paid: 0, revenue: 0 })
    } catch {
      message.error('تعذر تحميل اشتراكات الفرع')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [search, status, paymentStatus, dateRange])

  const columns = useMemo(
    () => [
      {
        title: 'العميل',
        key: 'user',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div style={{ fontWeight: 700 }}>{row.user.name}</div>
            <Text type="secondary">{row.user.phone || row.user.email || '-'}</Text>
          </div>
        ),
      },
      {
        title: 'الخطة',
        key: 'plan',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div style={{ fontWeight: 700 }}>{row.plan.title}</div>
            <Text type="secondary">{formatCurrency(row.plan.price, row.plan.currency)}</Text>
          </div>
        ),
      },
      {
        title: 'المتبقي',
        key: 'hours',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div>{row.remainingHours ?? 'غير محدود'} ساعة</div>
            <Text type="secondary">من {row.totalHours ?? 'غير محدود'}</Text>
          </div>
        ),
      },
      {
        title: 'الحالة',
        key: 'status',
        render: (_: unknown, row: SubscriptionRow) => (
          <Space direction="vertical" size={4}>
            <Tag color={row.status === 'active' ? 'green' : row.status === 'expired' ? 'orange' : row.status === 'depleted' ? 'red' : 'default'}>{row.status}</Tag>
            <Tag color={row.paymentStatus === 'completed' ? 'blue' : row.paymentStatus === 'pending' ? 'gold' : 'red'}>{row.paymentStatus}</Tag>
          </Space>
        ),
      },
      {
        title: 'النهاية',
        dataIndex: 'endsAt',
        render: (value: string) => formatDate(value),
      },
      {
        title: 'التفاصيل',
        key: 'actions',
        render: (_: unknown, row: SubscriptionRow) => <a onClick={() => navigate(`/subscriptions/${row.id}`)}>عرض</a>,
      },
    ],
    [],
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <Title level={2} style={{ margin: 0 }}>اشتراكات الفرع</Title>
            <Text type="secondary">متابعة العملاء المشتركين في هذا الفرع وساعاتهم المتبقية.</Text>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} xl={4}><Card><Statistic title="الإجمالي" value={stats.total} prefix={<CalendarOutlined />} /></Card></Col>
            <Col xs={12} xl={4}><Card><Statistic title="نشطة" value={stats.active} valueStyle={{ color: '#16a34a' }} /></Card></Col>
            <Col xs={12} xl={4}><Card><Statistic title="منتهية" value={stats.expired} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
            <Col xs={12} xl={4}><Card><Statistic title="مستهلكة" value={stats.depleted} valueStyle={{ color: '#dc2626' }} /></Card></Col>
            <Col xs={12} xl={4}><Card><Statistic title="مدفوعة" value={stats.paid} prefix={<CreditCardOutlined />} /></Card></Col>
            <Col xs={12} xl={4}><Card><Statistic title="الإيراد" value={stats.revenue} formatter={(v) => formatCurrency(Number(v || 0))} /></Card></Col>
          </Row>

          <Card style={{ marginBottom: 24 }}>
            <Space wrap size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
                <Input allowClear size="large" style={{ width: 260 }} placeholder="بحث بالعميل أو اسم الخطة" prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} />
                <Select
                  allowClear
                  size="large"
                  style={{ width: 170 }}
                  placeholder="حالة الاشتراك"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'active', label: 'نشط' },
                    { value: 'expired', label: 'منتهي' },
                    { value: 'depleted', label: 'مستهلك' },
                    { value: 'cancelled', label: 'ملغي' },
                  ]}
                />
                <Select
                  allowClear
                  size="large"
                  style={{ width: 170 }}
                  placeholder="حالة الدفع"
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                  options={[
                    { value: 'completed', label: 'مدفوع' },
                    { value: 'pending', label: 'بانتظار الدفع' },
                    { value: 'failed', label: 'فشل الدفع' },
                  ]}
                />
                <RangePicker size="large" onChange={setDateRange as any} />
              </Space>
              <a onClick={() => loadRows()}><ReloadOutlined /> تحديث</a>
            </Space>
          </Card>

          <Card>
            <Table<SubscriptionRow>
              rowKey="id"
              loading={loading}
              dataSource={rows}
              columns={columns as any}
              locale={{ emptyText: <Empty description="لا توجد اشتراكات حالياً" /> }}
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 900 }}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
