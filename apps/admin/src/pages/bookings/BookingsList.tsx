import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Input, Select, DatePicker, Card, Statistic, Row, Col, Avatar, Tooltip } from 'antd'
import { useNavigate } from 'react-router-dom'
import { 
  CalendarOutlined, 
  SearchOutlined, 
  EyeOutlined, 
  FilterOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined
} from '@ant-design/icons'
import { apiGet } from '../../api'
import '../../theme.css'

const { RangePicker } = DatePicker

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
  const navigate = useNavigate()

  useEffect(() => {
    loadBookings()
  }, [])

  async function loadBookings() {
    setLoading(true)
    try {
      const response = await apiGet<{
        bookings: BookingRow[]
        stats: BookingStats
      }>('/bookings/admin/all?page=1&limit=100')
      
      setBookings(response.bookings || [])
      setStats(response.stats || {
        total: 0,
        confirmed: 0,
        pending: 0,
        cancelled: 0,
        totalRevenue: 0
      })
    } catch (error) {
      console.error('Failed to load bookings:', error)
      // Set mock data for development
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
    } finally {
      setLoading(false)
    }
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
    
    return matchesSearch && matchesStatus && matchesDate
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
            {record.branch.name}
          </div>
          <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
            {record.hall?.name || 'لم يتم تحديد القاعة'}
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
            {record.totalPrice.toLocaleString()} ر.س
          </div>
          {record.discountAmount && (
            <div style={{ color: '#ff4d4f', fontSize: '12px' }}>
              خصم: {record.discountAmount} ر.س
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
              onClick={() => navigate(`/bookings/${record.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
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
            <Space size="middle" wrap style={{ width: '100%' }}>
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

              <RangePicker
                placeholder={['من تاريخ', 'إلى تاريخ']}
                value={dateRange}
                onChange={setDateRange}
                size="large"
                style={{ width: 250 }}
              />
            </Space>
          </Card>

          {/* Bookings Table */}
          <Card className="custom-card">
            <Table<BookingRow>
              rowKey="id"
              dataSource={filteredBookings}
              columns={columns}
              loading={loading}
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


