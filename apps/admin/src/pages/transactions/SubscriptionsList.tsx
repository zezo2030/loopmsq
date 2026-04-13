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
import {
  CalendarOutlined,
  CreditCardOutlined,
  FieldTimeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
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
  plan: {
    id: string
    title: string
    usageMode: string
    durationMonths: number | null
    price: number
    currency: string
    imageUrl: string | null
  }
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
  total: number
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
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<string | undefined>()
  const [paymentStatus, setPaymentStatus] = useState<string | undefined>()
  const [branchId, setBranchId] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<any>(null)
  const navigate = useNavigate()

  const formatCurrency = (value: number, currency = 'SAR') =>
    `${new Intl.NumberFormat('ar-SA').format(value || 0)} ${currency}`

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString('ar-SA') : '-'

  const loadBranches = async () => {
    try {
      const resp = await apiGet<any>('/content/branches?includeInactive=true')
      const list = Array.isArray(resp) ? resp : (resp?.items || resp?.branches || [])
      setBranches(
        list.map((branch: any) => ({
          id: branch.id,
          name: branch.name_ar || branch.name_en || 'فرع',
        })),
      )
    } catch {
      setBranches([])
    }
  }

  const loadRows = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', limit: '100' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status) params.set('status', status)
      if (paymentStatus) params.set('paymentStatus', paymentStatus)
      if (branchId) params.set('branchId', branchId)
      if (dateRange?.[0] && dateRange?.[1]) {
        params.set('from', dayjs(dateRange[0]).startOf('day').toISOString())
        params.set('to', dayjs(dateRange[1]).endOf('day').toISOString())
      }

      const data = await apiGet<ResponseShape>(`/subscription-purchases/admin/all?${params.toString()}`)
      setRows(data.subscriptions || [])
      setStats(
        data.stats || {
          total: 0,
          active: 0,
          expired: 0,
          depleted: 0,
          paid: 0,
          revenue: 0,
        },
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`تعذر تحميل الاشتراكات${detail ? `: ${detail}` : ''}`)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBranches()
  }, [])

  useEffect(() => {
    const delay = search.trim() ? 400 : 0
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), delay)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    loadRows()
  }, [debouncedSearch, status, paymentStatus, branchId, dateRange])

  const columns = useMemo(
    () => [
      {
        title: 'المشترك',
        key: 'user',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div style={{ fontWeight: 700 }}>{row.user.name || 'مستخدم'}</div>
            <Text type="secondary">{row.user.phone || row.user.email || '-'}</Text>
          </div>
        ),
      },
      {
        title: 'الفرع',
        dataIndex: ['branch', 'name'],
      },
      {
        title: 'الخطة',
        key: 'plan',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div style={{ fontWeight: 700 }}>{row.plan.title}</div>
            <Text type="secondary">
              {formatCurrency(row.plan.price, row.plan.currency)}
            </Text>
          </div>
        ),
      },
      {
        title: 'الساعات',
        key: 'hours',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div>المتبقي: {row.remainingHours ?? 'غير محدود'}</div>
            <Text type="secondary">الإجمالي: {row.totalHours ?? 'غير محدود'}</Text>
          </div>
        ),
      },
      {
        title: 'الحالة',
        key: 'status',
        render: (_: unknown, row: SubscriptionRow) => (
          <Space direction="vertical" size={4}>
            <Tag color={row.status === 'active' ? 'green' : row.status === 'expired' ? 'orange' : row.status === 'depleted' ? 'red' : 'default'}>
              {row.status === 'active' && 'نشط'}
              {row.status === 'expired' && 'منتهي'}
              {row.status === 'depleted' && 'مستهلك'}
              {row.status === 'cancelled' && 'ملغي'}
            </Tag>
            <Tag color={row.paymentStatus === 'completed' ? 'blue' : row.paymentStatus === 'pending' ? 'gold' : 'red'}>
              {row.paymentStatus === 'completed' && 'مدفوع'}
              {row.paymentStatus === 'pending' && 'بانتظار الدفع'}
              {row.paymentStatus === 'failed' && 'فشل الدفع'}
            </Tag>
          </Space>
        ),
      },
      {
        title: 'فترة الاشتراك',
        key: 'period',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div>{formatDate(row.startedAt)}</div>
            <Text type="secondary">حتى {formatDate(row.endsAt)}</Text>
          </div>
        ),
      },
      {
        title: 'التفاصيل',
        key: 'actions',
        render: (_: unknown, row: SubscriptionRow) => (
          <a onClick={() => navigate(`/admin/finance/subscriptions/${row.id}`)}>عرض</a>
        ),
      },
    ],
    [],
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <Title level={2} style={{ margin: 0 }}>الاشتراكات المشتراة</Title>
            <Text type="secondary">متابعة جميع اشتراكات العملاء عبر الفروع مع حالة الدفع والاستهلاك.</Text>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="إجمالي الاشتراكات" value={stats.total} prefix={<CalendarOutlined />} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="النشطة" value={stats.active} valueStyle={{ color: '#16a34a' }} prefix={<FieldTimeOutlined />} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="المنتهية" value={stats.expired} valueStyle={{ color: '#f59e0b' }} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="المستهلكة" value={stats.depleted} valueStyle={{ color: '#dc2626' }} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="المدفوعة" value={stats.paid} prefix={<CreditCardOutlined />} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="الإيراد" value={stats.revenue} formatter={(v) => formatCurrency(Number(v || 0))} /></Card>
            </Col>
          </Row>

          <Card style={{ marginBottom: 24 }}>
            <Space wrap size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
                <Input
                  allowClear
                  size="large"
                  style={{ width: 260 }}
                  placeholder="بحث بالعميل أو الفرع أو اسم الخطة"
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select
                  allowClear
                  size="large"
                  style={{ width: 180 }}
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
                  style={{ width: 180 }}
                  placeholder="حالة الدفع"
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                  options={[
                    { value: 'completed', label: 'مدفوع' },
                    { value: 'pending', label: 'بانتظار الدفع' },
                    { value: 'failed', label: 'فشل الدفع' },
                  ]}
                />
                <Select
                  allowClear
                  size="large"
                  style={{ width: 220 }}
                  placeholder="الفرع"
                  value={branchId}
                  onChange={setBranchId}
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
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
              locale={{
                emptyText: <Empty description="لا توجد اشتراكات مطابقة" />,
              }}
              pagination={{ pageSize: 12, showSizeChanger: true }}
              scroll={{ x: 1100 }}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
