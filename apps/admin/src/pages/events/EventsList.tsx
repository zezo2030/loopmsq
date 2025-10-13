import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Input, Select, Card, Statistic, Row, Col, Avatar, Tooltip, Badge } from 'antd'
import { useNavigate } from 'react-router-dom'
import { 
  GiftOutlined, 
  SearchOutlined, 
  EyeOutlined, 
  FilterOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  DollarOutlined,
  CalendarOutlined,
  EnvironmentOutlined
} from '@ant-design/icons'
import { apiGet } from '../../api'
import '../../theme.css'

type EventRequest = {
  id: string
  requester: {
    id: string
    name?: string
    email?: string
    phone?: string
  }
  type: string // birthday, graduation, family, etc.
  decorated: boolean
  branchId: string
  branch?: {
    id: string
    name: string
    location?: string
  }
  hallId?: string
  hall?: {
    id: string
    name: string
  }
  startTime: string
  durationHours: number
  persons: number
  addOns?: Array<{
    id: string
    name: string
    price: number
    quantity: number
  }>
  notes?: string
  status: 'draft' | 'submitted' | 'under_review' | 'quoted' | 'invoiced' | 'paid' | 'confirmed' | 'rejected'
  quotedPrice?: number
  createdAt: string
  updatedAt: string
}

type EventStats = {
  total: number
  pending: number
  quoted: number
  confirmed: number
  totalRevenue: number
}

export default function EventsList() {
  const [events, setEvents] = useState<EventRequest[]>([])
  const [stats, setStats] = useState<EventStats>({
    total: 0,
    pending: 0,
    quoted: 0,
    confirmed: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const navigate = useNavigate()

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    setLoading(true)
    try {
      const response = await apiGet<{
        requests: EventRequest[]
        stats: EventStats
      }>('/events/admin/all?page=1&limit=100')
      
      setEvents(response.requests || [])
      setStats(response.stats || {
        total: 0,
        pending: 0,
        quoted: 0,
        confirmed: 0,
        totalRevenue: 0
      })
    } catch (error) {
      console.error('Failed to load events:', error)
      // Mock data for development
      setEvents([
        {
          id: '1',
          requester: { 
            id: '1', 
            name: 'سارة محمد', 
            email: 'sara@email.com', 
            phone: '+966501234567' 
          },
          type: 'birthday',
          decorated: true,
          branchId: '1',
          branch: { id: '1', name: 'فرع الرياض', location: 'الرياض' },
          hallId: '1',
          hall: { id: '1', name: 'قاعة الماسة' },
          startTime: '2024-02-20T16:00:00Z',
          durationHours: 4,
          persons: 30,
          addOns: [
            { id: '1', name: 'تورتة عيد ميلاد', price: 300, quantity: 1 },
            { id: '2', name: 'بالونات ملونة', price: 150, quantity: 2 }
          ],
          notes: 'حفلة عيد ميلاد للطفلة ليلى، 8 سنوات. يرجى تجهيز ديكور وردي.',
          status: 'quoted',
          quotedPrice: 2200,
          createdAt: '2024-01-25T10:00:00Z',
          updatedAt: '2024-01-26T14:30:00Z'
        },
        {
          id: '2',
          requester: { 
            id: '2', 
            name: 'أحمد علي', 
            email: 'ahmed@email.com', 
            phone: '+966502345678' 
          },
          type: 'graduation',
          decorated: false,
          branchId: '1',
          branch: { id: '1', name: 'فرع الرياض', location: 'الرياض' },
          startTime: '2024-02-25T18:00:00Z',
          durationHours: 3,
          persons: 50,
          notes: 'حفل تخرج من الجامعة',
          status: 'submitted',
          createdAt: '2024-01-28T12:00:00Z',
          updatedAt: '2024-01-28T12:00:00Z'
        }
      ])
      setStats({
        total: 18,
        pending: 5,
        quoted: 8,
        confirmed: 4,
        totalRevenue: 32400
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredEvents = events.filter(event => {
    const matchesSearch = !searchText || 
      event.requester.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      event.requester.email?.toLowerCase().includes(searchText.toLowerCase()) ||
      event.requester.phone?.includes(searchText) ||
      event.type.toLowerCase().includes(searchText.toLowerCase()) ||
      event.notes?.toLowerCase().includes(searchText.toLowerCase())
    
    const matchesStatus = !statusFilter || event.status === statusFilter
    const matchesType = !typeFilter || event.type === typeFilter
    
    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success'
      case 'submitted': return 'processing'
      case 'under_review': return 'warning'
      case 'quoted': return 'purple'
      case 'invoiced': return 'geekblue'
      case 'paid': return 'cyan'
      case 'rejected': return 'error'
      case 'draft': return 'default'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'مسودة'
      case 'submitted': return 'مرسل'
      case 'under_review': return 'قيد المراجعة'
      case 'quoted': return 'تم التسعير'
      case 'invoiced': return 'تم إرسال الفاتورة'
      case 'paid': return 'تم الدفع'
      case 'confirmed': return 'مؤكد'
      case 'rejected': return 'مرفوض'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': 
        return <CheckCircleOutlined />
      case 'submitted': 
      case 'under_review':
        return <ClockCircleOutlined />
      case 'quoted':
      case 'invoiced':
        return <FileTextOutlined />
      case 'paid':
        return <DollarOutlined />
      case 'rejected': 
        return <CloseCircleOutlined />
      default: return null
    }
  }

  const getEventTypeText = (type: string) => {
    switch (type) {
      case 'birthday': return 'عيد ميلاد'
      case 'graduation': return 'تخرج'
      case 'family': return 'عائلي'
      case 'wedding': return 'زفاف'
      case 'corporate': return 'شركات'
      case 'other': return 'أخرى'
      default: return type
    }
  }

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'birthday': return '🎂'
      case 'graduation': return '🎓'
      case 'family': return '👨‍👩‍👧‍👦'
      case 'wedding': return '💒'
      case 'corporate': return '🏢'
      default: return '🎉'
    }
  }

  const columns = [
    {
      title: 'العميل والحدث',
      key: 'customer',
      render: (_: any, record: EventRequest) => (
        <Space size="middle">
          <Avatar 
            size={40} 
            icon={<UserOutlined />}
            style={{ backgroundColor: '#722ed1' }}
          />
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>
              {record.requester.name || 'غير محدد'}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
              {record.requester.email}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ fontSize: '14px' }}>{getEventTypeIcon(record.type)}</span>
              <span style={{ fontSize: '12px', color: '#722ed1', fontWeight: '500' }}>
                {getEventTypeText(record.type)}
              </span>
              {record.decorated && (
                <Tag size="small" color="gold">مُزيّن</Tag>
              )}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'المكان والوقت',
      key: 'venue',
      render: (_: any, record: EventRequest) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <EnvironmentOutlined style={{ marginRight: '6px', color: '#1890ff' }} />
            <span style={{ fontWeight: '600', fontSize: '14px' }}>
              {record.branch?.name || 'غير محدد'}
            </span>
          </div>
          {record.hall && (
            <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: '4px' }}>
              {record.hall.name}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', color: '#8c8c8c', fontSize: '12px' }}>
            <CalendarOutlined style={{ marginRight: '6px' }} />
            {new Date(record.startTime).toLocaleDateString('ar-SA')}
          </div>
          <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
            {new Date(record.startTime).toLocaleTimeString('ar-SA', {
              hour: '2-digit',
              minute: '2-digit'
            })} ({record.durationHours} ساعات)
          </div>
        </div>
      ),
    },
    {
      title: 'التفاصيل',
      key: 'details',
      render: (_: any, record: EventRequest) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
            <UserOutlined style={{ marginRight: '6px', color: '#52c41a' }} />
            <span style={{ fontWeight: '600' }}>
              {record.persons} شخص
            </span>
          </div>
          {record.addOns && record.addOns.length > 0 && (
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
              إضافات: {record.addOns.length} عنصر
            </div>
          )}
          {record.notes && (
            <div style={{ 
              fontSize: '12px', 
              color: '#8c8c8c',
              maxWidth: '200px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {record.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'الحالة والسعر',
      key: 'status',
      render: (_: any, record: EventRequest) => (
        <div>
          <Tag 
            color={getStatusColor(record.status)} 
            icon={getStatusIcon(record.status)}
            className="custom-tag"
            style={{ marginBottom: '4px' }}
          >
            {getStatusText(record.status)}
          </Tag>
          {record.quotedPrice && (
            <div style={{ 
              fontSize: '14px', 
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
      render: (_: any, record: EventRequest) => (
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
      render: (_: any, record: EventRequest) => (
        <Space size="small">
          <Tooltip title="عرض التفاصيل">
            <Button 
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/events/${record.id}`)}
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
              <GiftOutlined style={{ marginRight: '12px' }} />
              الأحداث الخاصة
            </h1>
            <p className="page-subtitle">
              إدارة ومتابعة طلبات الأحداث الخاصة وتقديم العروض
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
                  prefix={<GiftOutlined />}
                  valueStyle={{ color: '#722ed1', fontSize: '28px', fontWeight: 'bold' }}
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
                  title="تم التسعير"
                  value={stats.quoted}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#722ed1', fontSize: '28px', fontWeight: 'bold' }}
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
                placeholder="البحث بالاسم، الإيميل، نوع الحدث..."
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
                  { label: 'مسودة', value: 'draft' },
                  { label: 'مرسل', value: 'submitted' },
                  { label: 'قيد المراجعة', value: 'under_review' },
                  { label: 'تم التسعير', value: 'quoted' },
                  { label: 'تم إرسال الفاتورة', value: 'invoiced' },
                  { label: 'تم الدفع', value: 'paid' },
                  { label: 'مؤكد', value: 'confirmed' },
                  { label: 'مرفوض', value: 'rejected' },
                ]}
              />

              <Select
                placeholder="فلترة حسب نوع الحدث"
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 180 }}
                size="large"
                allowClear
                options={[
                  { label: '🎂 عيد ميلاد', value: 'birthday' },
                  { label: '🎓 تخرج', value: 'graduation' },
                  { label: '👨‍👩‍👧‍👦 عائلي', value: 'family' },
                  { label: '💒 زفاف', value: 'wedding' },
                  { label: '🏢 شركات', value: 'corporate' },
                  { label: '🎉 أخرى', value: 'other' },
                ]}
              />
            </Space>
          </Card>

          {/* Events Table */}
          <Card className="custom-card">
            <Table<EventRequest>
              rowKey="id"
              dataSource={filteredEvents}
              columns={columns}
              loading={loading}
              pagination={{
                total: filteredEvents.length,
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} من ${total} طلب`,
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}


