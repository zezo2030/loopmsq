import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Input, Select, DatePicker, Card, Statistic, Row, Col, Avatar, Tooltip, message } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  CalendarOutlined, 
  SearchOutlined, 
  EyeOutlined, 
  FilterOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ReloadOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { apiGet } from '../../api'
import '../../theme.css'

const { RangePicker } = DatePicker

// Helper to safely pick a display name from various possible keys
const displayName = (o?: any) =>
  o?.name ?? o?.name_ar ?? o?.nameAr ?? o?.name_en ?? o?.nameEn ?? ''

type BookingRow = {
  id: string
  user: {
    id: string
    name?: string
    email?: string
    phone?: string
  }
  branch: {
    id: string
    name: string
    location?: string
  }
  hall?: {
    id: string
    name: string
  }
  startTime: string
  durationHours: number
  persons: number
  totalPrice: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  addOns?: Array<{
    id: string
    name: string
    price: number
    quantity: number
  }>
  couponCode?: string
  discountAmount?: number
  createdAt: string
  // Pricing details from backend
  pricing?: {
    basePrice: number
    hourlyPrice: number
    personsPrice: number
    pricePerPerson: number
    multiplier: number
    decorationPrice: number
    totalPrice: number
  }
}

type BookingStats = {
  total: number
  confirmed: number
  pending: number
  cancelled: number
  totalRevenue: number
}

export default function BookingsList() {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [stats, setStats] = useState<BookingStats>({
    total: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateRange, setDateRange] = useState<[any, any] | null>(null)
  const [branchFilter, setBranchFilter] = useState<string>('')
  const [hallFilter, setHallFilter] = useState<string>('')
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [halls, setHalls] = useState<Array<{ id: string; name: string; branchId: string }>>([])
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  function formatSAR(value: number): string {
    try {
      return new Intl.NumberFormat('ar-SA').format(value)
    } catch {
      return String(value)
    }
  }

  useEffect(() => {
    // Initialize filters from URL
    const s = searchParams.get('q') || ''
    const st = searchParams.get('status') || ''
    const b = searchParams.get('branchId') || ''
    const h = searchParams.get('hallId') || ''
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    setSearchText(s)
    setStatusFilter(st)
    setBranchFilter(b)
    setHallFilter(h)
    if (from && to) {
      // AntD dayjs-compatible strings; we’ll keep raw strings and coerce on compare
      setDateRange([{
        toDate: () => new Date(from)
      } as any, {
        toDate: () => new Date(to)
      } as any])
    }
    loadBookings()
    loadBranches()
  }, [])

  useEffect(() => {
    // Load halls when branch changes
    if (!branchFilter) {
      setHalls([])
      setHallFilter('')
      return
    }
    loadHalls(branchFilter)
  }, [branchFilter])

  useEffect(() => {
    // Sync filters to URL
    const params: Record<string, string> = {}
    if (searchText) params.q = searchText
    if (statusFilter) params.status = statusFilter
    if (branchFilter) params.branchId = branchFilter
    if (hallFilter) params.hallId = hallFilter
    if (dateRange?.[0]?.toDate && dateRange?.[1]?.toDate) {
      const fromISO = new Date(dateRange[0].toDate()).toISOString()
      const toISO = new Date(dateRange[1].toDate()).toISOString()
      params.from = fromISO
      params.to = toISO
    }
    setSearchParams(params, { replace: true })
  }, [searchText, statusFilter, branchFilter, hallFilter, dateRange])

  async function loadBookings() {
    setLoading(true)
    try {
      const response = await apiGet<{
        bookings: BookingRow[]
        stats: BookingStats
      }>('/bookings/admin/all?page=1&limit=100')
      
      // Normalize names so UI can always use .name
      const normalized = (response.bookings || []).map((b: any) => ({
        ...b,
        branch: b.branch ? { 
          ...b.branch, 
          name: displayName(b.branch),
          id: b.branch.id || b.branchId 
        } : { id: b.branchId, name: 'غير محدد' },
        hall: b.hall ? { 
          ...b.hall, 
          name: displayName(b.hall),
          id: b.hall.id || b.hallId 
        } : b.hallId ? { id: b.hallId, name: 'غير محدد' } : null,
      }))

      setBookings(normalized as BookingRow[])
      setStats(response.stats || {
        total: 0,
        confirmed: 0,
        pending: 0,
        cancelled: 0,
        totalRevenue: 0
      })
    } catch (error) {
      console.error('Failed to load bookings:', error)
      message.warning('تعذّر تحميل الحجوزات، يتم عرض بيانات تجريبية')
      // Set mock data for development only
      if (import.meta.env.DEV) {
        setBookings([
          {
            id: '1',
            user: { id: '1', name: 'أحمد محمد', email: 'ahmed@example.com', phone: '+966501234567' },
            branch: { id: '1', name: 'فرع الرياض', location: 'الرياض' },
            hall: { id: '1', name: 'قاعة A1' },
            startTime: '2024-01-15T14:00:00Z',
            durationHours: 3,
            persons: 25,
            totalPrice: 2500,
            status: 'confirmed',
            addOns: [
              { id: '1', name: 'كاميرا تصوير', price: 200, quantity: 1 }
            ],
            createdAt: '2024-01-10T10:00:00Z'
          }
        ])
        setStats({
          total: 156,
          confirmed: 98,
          pending: 32,
          cancelled: 26,
          totalRevenue: 425000
        })
      } else {
        setBookings([])
        setStats({
          total: 0,
          confirmed: 0,
          pending: 0,
          cancelled: 0,
          totalRevenue: 0
        })
      }
    } finally {
      setLoading(false)
    }
  }

  function clearFilters() {
    setSearchText('')
    setStatusFilter('')
    setBranchFilter('')
    setHallFilter('')
    setDateRange(null)
  }

  async function loadBranches() {
    try {
      const resp = await apiGet<Array<{ id: string; name_en?: string; name_ar?: string }>>('/content/branches')
      setBranches((resp || []).map(b => ({ id: b.id as any, name: (b as any).name_ar || (b as any).name_en || 'Branch' })))
    } catch {}
  }

  async function loadHalls(branchId: string) {
    try {
      const resp = await apiGet<Array<{ id: string; name_en?: string; name_ar?: string; branchId: string }>>(`/content/halls?branchId=${branchId}`)
      setHalls((resp || []).map(h => ({ id: h.id, name: (h as any).name_ar || (h as any).name_en || 'Hall', branchId: (h as any).branchId })))
    } catch {}
  }

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = !searchText || 
      booking.user.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      booking.user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
      booking.user.phone?.includes(searchText) ||
      booking.hall?.name?.toLowerCase().includes(searchText.toLowerCase())
    
    const matchesStatus = !statusFilter || booking.status === statusFilter
    
    const matchesDate = !dateRange || (
      new Date(booking.startTime) >= dateRange[0]?.toDate() &&
      new Date(booking.startTime) <= dateRange[1]?.toDate()
    )

    const matchesBranch = !branchFilter || booking.branch.id === branchFilter
    const matchesHall = !hallFilter || booking.hall?.id === hallFilter
    
    return matchesSearch && matchesStatus && matchesDate && matchesBranch && matchesHall
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success'
      case 'pending': return 'processing'
      case 'cancelled': return 'error'
      case 'completed': return 'default'
      default: return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircleOutlined />
      case 'pending': return <ClockCircleOutlined />
      case 'cancelled': return <CloseCircleOutlined />
      case 'completed': return <CheckCircleOutlined />
      default: return null
    }
  }

  const columns = [
    {
      title: 'العميل',
      key: 'customer',
      render: (_: any, record: BookingRow) => (
        <Space size="middle">
          <Avatar 
            size={40} 
            icon={<UserOutlined />}
            style={{ backgroundColor: '#1890ff' }}
          />
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>
              {record.user.name || 'غير محدد'}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
              {record.user.email}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
              {record.user.phone}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'الفرع والقاعة',
      key: 'venue',
      render: (_: any, record: BookingRow) => (
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px' }}>
            {record.branch?.name || 'غير محدد'}
          </div>
          <div style={{ 
            color: record.hall?.name ? '#8c8c8c' : '#ff4d4f', 
            fontSize: '12px',
            fontWeight: record.hall?.name ? 'normal' : '500'
          }}>
            {record.hall?.name || '⚠️ لم يتم تحديد القاعة'}
          </div>
        </div>
      ),
    },
    {
      title: 'موعد الحجز',
      key: 'schedule',
      render: (_: any, record: BookingRow) => (
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px' }}>
            {new Date(record.startTime).toLocaleDateString('ar-SA')}
          </div>
          <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
            {new Date(record.startTime).toLocaleTimeString('ar-SA', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
          <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
            {record.durationHours} ساعات
          </div>
        </div>
      ),
    },
    {
      title: 'عدد الأشخاص',
      dataIndex: 'persons',
      key: 'persons',
      render: (persons: number) => (
        <span style={{ fontWeight: '600' }}>{persons} شخص</span>
      )
    },
    {
      title: 'السعر الإجمالي',
      key: 'price',
      render: (_: any, record: BookingRow) => (
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#52c41a' }}>
            {formatSAR(record.totalPrice)} ر.س
          </div>
          {record.discountAmount && (
            <div style={{ color: '#ff4d4f', fontSize: '12px' }}>
              خصم: {formatSAR(record.discountAmount)} ر.س
            </div>
          )}
          {record.couponCode && (
            <Tag color="gold">{record.couponCode}</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag 
          color={getStatusColor(status)} 
          icon={getStatusIcon(status)}
          className="custom-tag"
        >
          {status === 'confirmed' && 'مؤكد'}
          {status === 'pending' && 'في الانتظار'}
          {status === 'cancelled' && 'ملغي'}
          {status === 'completed' && 'مكتمل'}
        </Tag>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 120,
      render: (_: any, record: BookingRow) => (
        <Space size="small">
          <Tooltip title="عرض التفاصيل">
            <Button 
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/admin/bookings/${record.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">
              <CalendarOutlined style={{ marginRight: '12px' }} />
              إدارة الحجوزات
            </h1>
            <p className="page-subtitle">
              متابعة وإدارة جميع حجوزات القاعات والمرافق
            </p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Statistics Cards */}
          <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
            <Col xs={24} sm={12} lg={6}>
              <Card className="custom-card">
                <Statistic
                  title="إجمالي الحجوزات"
                  value={stats.total}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ color: '#1890ff', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="custom-card">
                <Statistic
                  title="حجوزات مؤكدة"
                  value={stats.confirmed}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="custom-card">
                <Statistic
                  title="في الانتظار"
                  value={stats.pending}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#faad14', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="custom-card">
                <Statistic
                  title="إجمالي الإيرادات"
                  value={stats.totalRevenue}
                  prefix={<DollarOutlined />}
                  suffix="ر.س"
                  valueStyle={{ color: '#13c2c2', fontSize: '28px', fontWeight: 'bold' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Search and Filters */}
          <Card className="custom-card" style={{ marginBottom: '24px' }}>
            <Space size="middle" wrap style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size="middle" wrap>
              <Input
                placeholder="البحث بالاسم، الإيميل، الهاتف، أو اسم القاعة..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 320 }}
                size="large"
                allowClear
              />
              
              <Select
                placeholder="فلترة حسب الحالة"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 180 }}
                size="large"
                allowClear
                suffixIcon={<FilterOutlined />}
                options={[
                  { label: 'مؤكد', value: 'confirmed' },
                  { label: 'في الانتظار', value: 'pending' },
                  { label: 'ملغي', value: 'cancelled' },
                  { label: 'مكتمل', value: 'completed' },
                ]}
              />

              <Select
                placeholder="اختر الفرع"
                value={branchFilter || undefined}
                onChange={setBranchFilter}
                style={{ width: 220 }}
                size="large"
                allowClear
                options={branches.map(b => ({ label: b.name, value: b.id }))}
              />

              <Select
                placeholder="اختر القاعة"
                value={hallFilter || undefined}
                onChange={setHallFilter}
                style={{ width: 220 }}
                size="large"
                allowClear
                disabled={!branchFilter}
                options={halls.map(h => ({ label: h.name, value: h.id }))}
              />

              <RangePicker
                placeholder={['من تاريخ', 'إلى تاريخ']}
                value={dateRange}
                onChange={setDateRange}
                size="large"
                style={{ width: 250 }}
              />
              </Space>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadBookings} size="large">
                  تحديث
                </Button>
                <Button onClick={clearFilters} size="large">
                  مسح الفلاتر
                </Button>
                <Button icon={<DownloadOutlined />} size="large" onClick={() => {
                  try {
                    const rows = filteredBookings.map(b => ({
                      id: b.id,
                      user: b.user.name,
                      email: b.user.email,
                      phone: b.user.phone,
                      branch: b.branch.name,
                      hall: b.hall?.name || '',
                      startTime: new Date(b.startTime).toISOString(),
                      persons: b.persons,
                      totalPrice: b.totalPrice,
                      status: b.status,
                    }))
                    const header = Object.keys(rows[0] || {}).join(',')
                    const body = rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
                    const csv = `${header}\n${body}`
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'bookings.csv'
                    a.click()
                    URL.revokeObjectURL(url)
                  } catch {
                    message.error('تعذّر التصدير')
                  }
                }}>
                  تصدير
                </Button>
              </Space>
            </Space>
          </Card>

          {/* Bookings Table */}
          <Card className="custom-card">
            <Table<BookingRow>
              rowKey="id"
              dataSource={filteredBookings}
              columns={columns}
              loading={loading}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ paddingInlineEnd: '24px' }}>
                    <Row gutter={[16, 8]}>
                      {/* Pricing Details */}
                      {record.pricing && (
                        <Col xs={24} md={8}>
                          <div style={{ fontWeight: 600, marginBottom: 8, color: '#1890ff' }}>تفصيل التسعير</div>
                          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span>السعر الأساسي:</span>
                              <span>{record.pricing.basePrice?.toLocaleString() || 0} ر.س</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span>السعر بالساعة:</span>
                              <span>{record.pricing.hourlyPrice?.toLocaleString() || 0} ر.س</span>
                            </div>
                            {record.pricing.pricePerPerson > 0 && (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span>السعر لكل شخص:</span>
                                  <span style={{ color: '#52c41a' }}>{record.pricing.pricePerPerson?.toLocaleString() || 0} ر.س</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span>إجمالي الأشخاص:</span>
                                  <span style={{ color: '#52c41a' }}>{record.pricing.personsPrice?.toLocaleString() || 0} ر.س</span>
                                </div>
                              </>
                            )}
                            {record.pricing.decorationPrice > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span>سعر الديكور:</span>
                                <span>{record.pricing.decorationPrice?.toLocaleString() || 0} ر.س</span>
                              </div>
                            )}
                            {record.pricing.multiplier !== 1 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span>المضاعف:</span>
                                <span style={{ color: '#fa8c16' }}>× {record.pricing.multiplier || 1}</span>
                              </div>
                            )}
                          </div>
                        </Col>
                      )}
                      
                      {/* Add-ons */}
                      <Col xs={24} md={record.pricing ? 8 : 12}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>الإضافات</div>
                        {(record.addOns && record.addOns.length > 0) ? (
                          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                            {record.addOns.map(a => (
                              <li key={a.id}>
                                {a.name} × {a.quantity} — {formatSAR(a.price * a.quantity)} ر.س
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div style={{ color: '#8c8c8c' }}>لا توجد إضافات</div>
                        )}
                      </Col>
                      
                      {/* Coupon and Discount */}
                      <Col xs={24} md={record.pricing ? 8 : 12}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>الكوبون والخصم</div>
                        {record.couponCode ? (
                          <Space>
                            <Tag color="gold">{record.couponCode}</Tag>
                            {record.discountAmount ? (
                              <span style={{ color: '#ff4d4f' }}>-{formatSAR(record.discountAmount)} ر.س</span>
                            ) : null}
                          </Space>
                        ) : (
                          <div style={{ color: '#8c8c8c' }}>لا يوجد كوبون</div>
                        )}
                      </Col>
                    </Row>
                  </div>
                )
              }}
              pagination={{
                total: filteredBookings.length,
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} من ${total} حجز`,
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}


