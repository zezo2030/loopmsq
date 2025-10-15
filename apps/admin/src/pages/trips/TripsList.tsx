import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Input, Select, Card, Statistic, Row, Col, Avatar, Tooltip, DatePicker } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  BookOutlined, 
  SearchOutlined, 
  EyeOutlined, 
  FilterOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  DollarOutlined,
  CalendarOutlined
} from '@ant-design/icons'
import { apiGet } from '../../api'
import '../../theme.css'

type TripRequest = {
  id: string
  requester: {
    id: string
    name?: string
    email?: string
    phone?: string
  }
  schoolName: string
  studentsCount: number
  accompanyingAdults?: number
  preferredDate: string
  preferredTime?: string
  durationHours: number
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'invoiced' | 'paid' | 'completed' | 'cancelled'
  contactPersonName: string
  contactPhone: string
  contactEmail?: string
  specialRequirements?: string
  quotedPrice?: number
  rejectionReason?: string
  adminNotes?: string
  createdAt: string
  updatedAt: string
}

type TripStats = {
  total: number
  pending: number
  approved: number
  completed: number
  totalRevenue: number
}

export default function TripsList() {
  const [trips, setTrips] = useState<TripRequest[]>([])
  const [stats, setStats] = useState<TripStats>({
    total: 0,
    pending: 0,
    approved: 0,
    completed: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateRange, setDateRange] = useState<[any, any] | null>(null)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const q = searchParams.get('q') || ''
    const st = searchParams.get('status') || ''
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    setSearchText(q)
    setStatusFilter(st)
    if (from && to) {
      setDateRange([{
        toDate: () => new Date(from)
      } as any, {
        toDate: () => new Date(to)
      } as any])
    }
    loadTrips()
  }, [])

  useEffect(() => {
    const params: Record<string, string> = {}
    if (searchText) params.q = searchText
    if (statusFilter) params.status = statusFilter
    if (dateRange?.[0]?.toDate && dateRange?.[1]?.toDate) {
      const fromISO = new Date(dateRange[0].toDate()).toISOString()
      const toISO = new Date(dateRange[1].toDate()).toISOString()
      params.from = fromISO
      params.to = toISO
    }
    setSearchParams(params, { replace: true })
  }, [searchText, statusFilter, dateRange])

  async function loadTrips() {
    setLoading(true)
    try {
      const response = await apiGet<{
        requests: TripRequest[]
        stats: TripStats
      }>('/trips/admin/all?page=1&limit=100')
      
      setTrips(response.requests || [])
      setStats(response.stats || {
        total: 0,
        pending: 0,
        approved: 0,
        completed: 0,
        totalRevenue: 0
      })
    } catch (error) {
      console.error('Failed to load trips:', error)
      // Mock data for development
      setTrips([
        {
          id: '1',
          requester: { 
            id: '1', 
            name: 'نورا أحمد', 
            email: 'nora@school.edu.sa', 
            phone: '+966501234567' 
          },
          schoolName: 'مدرسة النور الأهلية',
          studentsCount: 45,
          accompanyingAdults: 3,
          preferredDate: '2024-02-15',
          preferredTime: '09:00',
          durationHours: 3,
          status: 'approved',
          contactPersonName: 'نورا أحمد المعلمة',
          contactPhone: '+966501234567',
          contactEmail: 'nora@school.edu.sa',
          specialRequirements: 'طلاب مع احتياجات خاصة - يحتاجون كراسي متحركة',
          quotedPrice: 1800,
          createdAt: '2024-01-20T08:00:00Z',
          updatedAt: '2024-01-21T10:30:00Z'
        },
        {
          id: '2',
          requester: { 
            id: '2', 
            name: 'خالد محمد', 
            email: 'khalid@academy.sa', 
            phone: '+966502345678' 
          },
          schoolName: 'أكاديمية المستقبل',
          studentsCount: 35,
          accompanyingAdults: 2,
          preferredDate: '2024-02-20',
          durationHours: 4,
          status: 'pending',
          contactPersonName: 'خالد محمد',
          contactPhone: '+966502345678',
          contactEmail: 'khalid@academy.sa',
          createdAt: '2024-01-25T14:00:00Z',
          updatedAt: '2024-01-25T14:00:00Z'
        }
      ])
      setStats({
        total: 24,
        pending: 8,
        approved: 12,
        completed: 3,
        totalRevenue: 45600
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredTrips = trips.filter(trip => {
    const matchesSearch = !searchText || 
      trip.schoolName.toLowerCase().includes(searchText.toLowerCase()) ||
      trip.contactPersonName.toLowerCase().includes(searchText.toLowerCase()) ||
      trip.requester.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      trip.contactPhone.includes(searchText) ||
      trip.contactEmail?.toLowerCase().includes(searchText.toLowerCase())
    
    const matchesStatus = !statusFilter || trip.status === statusFilter
    const matchesDate = !dateRange || (
      new Date(trip.preferredDate) >= dateRange[0]?.toDate() &&
      new Date(trip.preferredDate) <= dateRange[1]?.toDate()
    )
    
    return matchesSearch && matchesStatus && matchesDate
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success'
      case 'pending': return 'processing'
      case 'under_review': return 'warning'
      case 'rejected': return 'error'
      case 'invoiced': return 'purple'
      case 'paid': return 'cyan'
      case 'completed': return 'default'
      case 'cancelled': return 'error'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'في الانتظار'
      case 'under_review': return 'قيد المراجعة'
      case 'approved': return 'مقبول'
      case 'rejected': return 'مرفوض'
      case 'invoiced': return 'تم إرسال الفاتورة'
      case 'paid': return 'تم الدفع'
      case 'completed': return 'مكتمل'
      case 'cancelled': return 'ملغي'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': 
      case 'completed': 
        return <CheckCircleOutlined />
      case 'pending': 
      case 'under_review':
        return <ClockCircleOutlined />
      case 'rejected': 
      case 'cancelled': 
        return <CloseCircleOutlined />
      case 'invoiced':
        return <FileTextOutlined />
      case 'paid':
        return <DollarOutlined />
      default: return null
    }
  }

  const columns = [
    {
      title: 'المدرسة',
      key: 'school',
      render: (_: any, record: TripRequest) => (
        <Space size="middle">
          <Avatar 
            size={40} 
            icon={<BookOutlined />}
            style={{ backgroundColor: '#52c41a' }}
          />
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>
              {record.schoolName}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
              {record.contactPersonName}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
              {record.contactPhone}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'تفاصيل الرحلة',
      key: 'details',
      render: (_: any, record: TripRequest) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <TeamOutlined style={{ marginRight: '6px', color: '#1890ff' }} />
            <span style={{ fontWeight: '600' }}>
              {record.studentsCount} طالب
            </span>
            {record.accompanyingAdults && (
              <span style={{ marginLeft: '8px', color: '#8c8c8c' }}>
                + {record.accompanyingAdults} مرافق
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#8c8c8c', fontSize: '12px' }}>
            <CalendarOutlined style={{ marginRight: '6px' }} />
            {new Date(record.preferredDate).toLocaleDateString('ar-SA')}
            {record.preferredTime && ` - ${record.preferredTime}`}
          </div>
          <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
            المدة: {record.durationHours} ساعات
          </div>
        </div>
      ),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: TripRequest) => (
        <div>
          <Tag 
            color={getStatusColor(status)} 
            icon={getStatusIcon(status)}
            className="custom-tag"
          >
            {getStatusText(status)}
          </Tag>
          {record.quotedPrice && (
            <div style={{ 
              marginTop: '4px', 
              fontSize: '12px', 
              fontWeight: '600',
              color: '#52c41a'
            }}>
              {record.quotedPrice.toLocaleString()} ر.س
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'تاريخ الطلب',
      key: 'created',
      render: (_: any, record: TripRequest) => (
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px' }}>
            {new Date(record.createdAt).toLocaleDateString('ar-SA')}
          </div>
          <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
            {new Date(record.createdAt).toLocaleTimeString('ar-SA', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 120,
      render: (_: any, record: TripRequest) => (
        <Space size="small">
          <Tooltip title="عرض التفاصيل">
            <Button 
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/trips/${record.id}`)}
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
              <BookOutlined style={{ marginRight: '12px' }} />
              الرحلات المدرسية
            </h1>
            <p className="page-subtitle">
              إدارة ومتابعة طلبات الرحلات المدرسية والموافقة عليها
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
                  title="إجمالي الطلبات"
                  value={stats.total}
                  prefix={<BookOutlined />}
                  valueStyle={{ color: '#1890ff', fontSize: '28px', fontWeight: 'bold' }}
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
                  title="مقبولة"
                  value={stats.approved}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a', fontSize: '28px', fontWeight: 'bold' }}
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
                placeholder="البحث باسم المدرسة، المسؤول، الهاتف..."
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
                  { label: 'في الانتظار', value: 'pending' },
                  { label: 'قيد المراجعة', value: 'under_review' },
                  { label: 'مقبول', value: 'approved' },
                  { label: 'مرفوض', value: 'rejected' },
                  { label: 'تم إرسال الفاتورة', value: 'invoiced' },
                  { label: 'تم الدفع', value: 'paid' },
                  { label: 'مكتمل', value: 'completed' },
                ]}
              />

              <DatePicker.RangePicker
                placeholder={["من تاريخ", "إلى تاريخ"]}
                value={dateRange as any}
                onChange={setDateRange as any}
                size="large"
                style={{ width: 260 }}
              />
            </Space>
          </Card>

          {/* Trips Table */}
          <Card className="custom-card">
            <Table<TripRequest>
              rowKey="id"
              dataSource={filteredTrips}
              columns={columns}
              loading={loading}
              pagination={{
                total: filteredTrips.length,
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} من ${total} طلب`,
              }}
              scroll={{ x: 1000 }}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}


