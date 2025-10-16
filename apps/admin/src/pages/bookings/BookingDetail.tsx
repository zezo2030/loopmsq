import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Card, 
  Descriptions, 
  Tag, 
  Space, 
  Button, 
  Modal, 
  Form, 
  Input, 
  message, 
  Divider,
  Row,
  Col,
  Avatar,
  Badge,
  Table
} from 'antd'
import { 
  ArrowLeftOutlined,
  UserOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  CloseOutlined,
  WarningOutlined,
  QrcodeOutlined,
  TeamOutlined
} from '@ant-design/icons'
import { apiGet, apiPost } from '../../api'
import '../../theme.css'

type Booking = {
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
    address?: string
  }
  hall?: {
    id: string
    name: string
    capacity: number
    amenities?: string[]
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
  specialRequests?: string
  contactPhone?: string
  cancelledAt?: string
  cancellationReason?: string
  createdAt: string
  updatedAt: string
}

type Ticket = {
  id: string
  type: string
  qrCode: string
  status: 'active' | 'used' | 'expired'
  usedAt?: string
  scannedBy?: string
}

export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelModalVisible, setCancelModalVisible] = useState(false)
  const [cancelForm] = Form.useForm()
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (id) {
      loadBookingData()
    }
  }, [id])

  async function loadBookingData() {
    setLoading(true)
    try {
      // Load booking details
      const bookingData = await apiGet<Booking>(`/bookings/${id}`)
      setBooking(bookingData)

      // Load tickets
      const ticketsData = await apiGet<Ticket[]>(`/bookings/${id}/tickets`)
      setTickets(ticketsData)
    } catch (error) {
      console.error('Failed to load booking:', error)
      // Mock data for development
      setBooking({
        id: '1',
        user: { 
          id: '1', 
          name: 'أحمد محمد علي', 
          email: 'ahmed@example.com', 
          phone: '+966501234567' 
        },
        branch: { 
          id: '1', 
          name: 'فرع الرياض الرئيسي', 
          location: 'الرياض',
          address: 'طريق الملك فهد، حي العليا، الرياض 12345'
        },
        hall: { 
          id: '1', 
          name: 'قاعة الماسة الكبرى', 
          capacity: 150,
          amenities: ['مكيف هواء', 'نظام صوتي', 'إضاءة LED', 'مطبخ صغير']
        },
        startTime: '2024-01-15T14:00:00Z',
        durationHours: 4,
        persons: 75,
        totalPrice: 3500,
        status: 'confirmed',
        addOns: [
          { id: '1', name: 'كاميرا تصوير احترافية', price: 500, quantity: 1 },
          { id: '2', name: 'تنسيق زهور', price: 300, quantity: 2 }
        ],
        couponCode: 'NEWUSER15',
        discountAmount: 200,
        specialRequests: 'يرجى تجهيز الصوتيات قبل ساعة من بداية الحفل',
        contactPhone: '+966501234567',
        createdAt: '2024-01-10T10:00:00Z',
        updatedAt: '2024-01-12T15:30:00Z'
      })

      setTickets([
        { id: '1', type: 'عام', qrCode: 'TKT001', status: 'active' },
        { id: '2', type: 'VIP', qrCode: 'TKT002', status: 'used', usedAt: '2024-01-15T14:30:00Z', scannedBy: 'سارة أحمد' }
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelBooking(values: { reason: string }) {
    if (!booking) return

    setCancelling(true)
    try {
      await apiPost(`/bookings/${booking.id}/cancel`, {
        reason: values.reason
      })
      
      message.success('تم إلغاء الحجز بنجاح')
      setCancelModalVisible(false)
      cancelForm.resetFields()
      
      // Reload booking data
      await loadBookingData()
    } catch (error) {
      message.error('فشل في إلغاء الحجز')
    } finally {
      setCancelling(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'success'
      case 'pending': return 'processing'
      case 'cancelled': return 'error'
      case 'completed': return 'default'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'مؤكد'
      case 'pending': return 'في الانتظار'
      case 'cancelled': return 'ملغي'
      case 'completed': return 'مكتمل'
      default: return status
    }
  }

  const ticketColumns = [
    {
      title: 'رقم التذكرة',
      dataIndex: 'qrCode',
      key: 'qrCode',
      render: (qrCode: string) => (
        <Space>
          <QrcodeOutlined />
          <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{qrCode}</span>
        </Space>
      )
    },
    {
      title: 'النوع',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          active: 'success',
          used: 'default',
          expired: 'error'
        }
        const texts = {
          active: 'نشط',
          used: 'مستخدم',
          expired: 'منتهي الصلاحية'
        }
        return <Tag color={colors[status as keyof typeof colors]}>{texts[status as keyof typeof texts]}</Tag>
      }
    },
    {
      title: 'تاريخ الاستخدام',
      key: 'usage',
      render: (_: any, record: Ticket) => {
        if (record.status === 'used' && record.usedAt) {
          return (
            <div>
              <div>{new Date(record.usedAt).toLocaleDateString('ar-SA')}</div>
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                بواسطة: {record.scannedBy}
              </div>
            </div>
          )
        }
        return '—'
      }
    }
  ]

  if (loading) {
    return (
      <div className="page-container">
        <Card loading={true} style={{ minHeight: '400px' }} />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="page-container">
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <WarningOutlined style={{ fontSize: '48px', color: '#faad14', marginBottom: '16px' }} />
            <h3>لم يتم العثور على الحجز</h3>
            <Button type="primary" onClick={() => navigate('/bookings')}>
              العودة إلى قائمة الحجوزات
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <Space size="middle" style={{ marginBottom: '8px' }}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/bookings')}
                size="large"
              />
              <h1 className="page-title" style={{ margin: 0 }}>
                تفاصيل الحجز #{booking.id.slice(-8)}
              </h1>
              <Badge
                status={booking.status === 'confirmed' ? 'success' : 
                       booking.status === 'pending' ? 'processing' : 'error'}
                text={getStatusText(booking.status)}
              />
            </Space>
            <p className="page-subtitle">
              تم الإنشاء في {new Date(booking.createdAt).toLocaleDateString('ar-SA')}
            </p>
          </div>
          <Space>
            {booking.status === 'confirmed' && (
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => setCancelModalVisible(true)}
              >
                إلغاء الحجز
              </Button>
            )}
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <Row gutter={[24, 24]}>
            {/* Customer Information */}
            <Col xs={24} lg={12}>
              <Card className="custom-card" title="معلومات العميل" extra={<UserOutlined />}>
                <Space size="large" style={{ width: '100%' }} direction="vertical">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                    <div>
                      <h3 style={{ margin: 0, marginBottom: '4px' }}>{booking.user.name}</h3>
                      <div style={{ color: '#8c8c8c', marginBottom: '2px' }}>{booking.user.email}</div>
                      <div style={{ color: '#8c8c8c' }}>{booking.user.phone}</div>
                    </div>
                  </div>
                  
                  {booking.contactPhone && booking.contactPhone !== booking.user.phone && (
                    <div>
                      <strong>هاتف التواصل للحجز:</strong> {booking.contactPhone}
                    </div>
                  )}
                </Space>
              </Card>
            </Col>

            {/* Venue Information */}
            <Col xs={24} lg={12}>
              <Card className="custom-card" title="معلومات المكان" extra={<EnvironmentOutlined />}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="الفرع">{booking.branch.name}</Descriptions.Item>
                  <Descriptions.Item label="العنوان">{booking.branch.address}</Descriptions.Item>
                  <Descriptions.Item label="القاعة">{booking.hall?.name || 'غير محدد'}</Descriptions.Item>
                  {booking.hall?.capacity && (
                    <Descriptions.Item label="سعة القاعة">
                      <Space>
                        <TeamOutlined />
                        {booking.hall.capacity} شخص
                      </Space>
                    </Descriptions.Item>
                  )}
                </Descriptions>
                
                {booking.hall?.amenities && (
                  <>
                    <Divider />
                    <div style={{ marginBottom: '8px', fontWeight: '600' }}>المرافق المتاحة:</div>
                    <Space wrap>
                      {booking.hall.amenities.map((amenity, index) => (
                        <Tag key={index} color="blue">{amenity}</Tag>
                      ))}
                    </Space>
                  </>
                )}
              </Card>
            </Col>

            {/* Booking Details */}
            <Col xs={24} lg={16}>
              <Card className="custom-card" title="تفاصيل الحجز" extra={<CalendarOutlined />}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="تاريخ ووقت الحجز">
                        <div style={{ fontWeight: '600' }}>
                          {new Date(booking.startTime).toLocaleDateString('ar-SA')}
                        </div>
                        <div style={{ color: '#8c8c8c' }}>
                          {new Date(booking.startTime).toLocaleTimeString('ar-SA', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </Descriptions.Item>
                      <Descriptions.Item label="المدة">{booking.durationHours} ساعات</Descriptions.Item>
                      <Descriptions.Item label="عدد الأشخاص">
                        <Space>
                          <TeamOutlined />
                          {booking.persons} شخص
                        </Space>
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="الحالة">
                        <Tag color={getStatusColor(booking.status)}>
                          {getStatusText(booking.status)}
                        </Tag>
                      </Descriptions.Item>
                      {booking.cancelledAt && (
                        <Descriptions.Item label="تاريخ الإلغاء">
                          {new Date(booking.cancelledAt).toLocaleString('ar-SA')}
                        </Descriptions.Item>
                      )}
                      {booking.cancellationReason && (
                        <Descriptions.Item label="سبب الإلغاء">
                          {booking.cancellationReason}
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </Col>
                </Row>

                {booking.specialRequests && (
                  <>
                    <Divider />
                    <div>
                      <strong>طلبات خاصة:</strong>
                      <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#fafafa', borderRadius: '6px' }}>
                        {booking.specialRequests}
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </Col>

            {/* Pricing Details */}
            <Col xs={24} lg={8}>
              <Card className="custom-card" title="تفاصيل السعر" extra={<DollarOutlined />}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {booking.addOns && booking.addOns.length > 0 && (
                    <>
                      <div style={{ fontWeight: '600', marginBottom: '8px' }}>الإضافات:</div>
                      {booking.addOns.map((addon, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: index < booking.addOns!.length - 1 ? '1px solid #f0f0f0' : 'none'
                        }}>
                          <div>
                            <div style={{ fontWeight: '500' }}>{addon.name}</div>
                            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                              الكمية: {addon.quantity}
                            </div>
                          </div>
                          <div style={{ fontWeight: '600' }}>
                            {(addon.price * addon.quantity).toLocaleString()} ر.س
                          </div>
                        </div>
                      ))}
                      <Divider />
                    </>
                  )}

                  {booking.couponCode && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <Tag color="gold">{booking.couponCode}</Tag>
                        <span>كود الخصم</span>
                      </div>
                      <div style={{ color: '#ff4d4f', fontWeight: '600' }}>
                        -{booking.discountAmount?.toLocaleString()} ر.س
                      </div>
                    </div>
                  )}

                  <Divider />
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: '18px', 
                    fontWeight: 'bold',
                    color: '#52c41a'
                  }}>
                    <span>المجموع الإجمالي:</span>
                    <span>{booking.totalPrice.toLocaleString()} ر.س</span>
                  </div>
                </Space>
              </Card>
            </Col>

            {/* Tickets */}
            {tickets.length > 0 && (
              <Col xs={24}>
                <Card className="custom-card" title="التذاكر" extra={<QrcodeOutlined />}>
                  <Table
                    dataSource={tickets}
                    columns={ticketColumns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                </Card>
              </Col>
            )}
          </Row>
        </div>
      </div>

      {/* Cancel Booking Modal */}
      <Modal
        title="إلغاء الحجز"
        open={cancelModalVisible}
        onCancel={() => setCancelModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={cancelForm}
          layout="vertical"
          onFinish={handleCancelBooking}
        >
          <Form.Item
            label="سبب الإلغاء"
            name="reason"
            rules={[{ required: true, message: 'يرجى إدخال سبب الإلغاء' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="اكتب سبب إلغاء الحجز..."
            />
          </Form.Item>
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'left' }}>
            <Space>
              <Button onClick={() => setCancelModalVisible(false)}>
                إلغاء
              </Button>
              <Button 
                type="primary" 
                danger 
                htmlType="submit" 
                loading={cancelling}
              >
                تأكيد الإلغاء
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


