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
  InputNumber,
  message, 
  Divider,
  Row,
  Col,
  Avatar,
  Badge,
  Steps,
  Alert,
  Table
} from 'antd'
import { 
  ArrowLeftOutlined,
  UserOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  CheckOutlined,
  FileTextOutlined,
  WarningOutlined,
  PhoneOutlined,
  MailOutlined,
  EditOutlined,
  StarOutlined,
  QrcodeOutlined
} from '@ant-design/icons'
import { apiGet, apiPost } from '../../api'
import '../../theme.css'
import { formatTimeAr } from '../../utils/formatDateTimeDisplay'

type EventRequest = {
  id: string
  requester: {
    id: string
    name?: string
    email?: string
    phone?: string
  }
  type: string
  decorated: boolean
  branchId: string
  branch?: {
    id: string
    name_ar?: string
    nameAr?: string
    location?: string
    capacity?: number
    amenities?: string[]
  }
  hallId?: string
  hall?: {
    id: string
    name: string
    capacity?: number
    amenities?: string[]
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
  paymentMethod?: string
  createdAt: string
  updatedAt: string
}

type Ticket = {
  id: string
  status: 'VALID' | 'USED' | 'EXPIRED' | 'CANCELLED'
  scannedAt?: string
  staffId?: string
}

const { Step } = Steps

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventRequest | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [quoteModalVisible, setQuoteModalVisible] = useState(false)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false)
  
  // Forms
  const [quoteForm] = Form.useForm()
  
  // Loading states
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadEventData()
    } else {
      message.error('معرف الحدث غير موجود')
      navigate('/admin/events')
    }
  }, [id, navigate])

  async function loadEventData() {
    setLoading(true)
    try {
      const eventData = await apiGet<EventRequest>(`/events/admin/${id}`)
      setEvent(eventData)

      // Load tickets if event is paid or confirmed
      if (eventData.status === 'paid' || eventData.status === 'confirmed') {
        try {
          const ticketsData = await apiGet<Ticket[]>(`/events/requests/${id}/tickets`)
          setTickets(ticketsData || [])
        } catch (error) {
          console.error('Failed to load tickets:', error)
          setTickets([])
        }
      } else {
        setTickets([])
      }
    } catch (error: any) {
      console.error('Failed to load event:', error)
      const errorMessage = error?.message || 'Failed to load event'
      console.error('Error details:', errorMessage)
      // Don't set mock data, let the component handle the error state
      setEvent(null)
      message.error(`فشل في تحميل بيانات الطلب: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleQuote(values: { quotedPrice: number; addOns?: any[]; notes?: string }) {
    if (!event) return

    setActionLoading(true)
    try {
      // API expects { basePrice } only. Map the form's quotedPrice to basePrice
      await apiPost(`/events/requests/${event.id}/quote`, {
        basePrice: values.quotedPrice,
      })
      message.success('تم إرسال العرض بنجاح')
      setQuoteModalVisible(false)
      quoteForm.resetFields()
      await loadEventData()
    } catch (error) {
      message.error('فشل في إرسال العرض')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleConfirm() {
    if (!event) return

    setActionLoading(true)
    try {
      await apiPost(`/events/requests/${event.id}/confirm`, {})
      message.success('تم تأكيد الحدث بنجاح')
      setConfirmModalVisible(false)
      await loadEventData()
    } catch (error) {
      message.error('فشل في تأكيد الحدث')
    } finally {
      setActionLoading(false)
    }
  }

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

  const getCurrentStep = (status: string) => {
    switch (status) {
      case 'submitted':
      case 'under_review':
        return 0
      case 'quoted':
        return 1
      case 'invoiced':
      case 'paid':
        return 2
      case 'confirmed':
        return 3
      case 'rejected':
        return -1
      default:
        return 0
    }
  }

  const ticketColumns = [
    {
      title: 'رقم التذكرة',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{id}</span>
      )
    },
    {
      title: 'النوع',
      key: 'type',
      render: () => 'عادي',
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: Ticket['status'], record: Ticket) => {
        const isUsed = status === 'USED' || !!record.scannedAt
        return (
          <Tag color={isUsed ? 'default' : 'success'}>
            {isUsed ? 'مستخدمة' : 'غير مستخدمة'}
          </Tag>
        )
      }
    },
    {
      title: 'تاريخ الاستخدام',
      key: 'usage',
      render: () => (
        <span>{event ? new Date(event.startTime).toLocaleDateString('ar-SA', { calendar: 'gregory' }) : ''}</span>
      )
    }
  ]

  if (loading) {
    return (
      <div className="page-container">
        <Card loading={true} style={{ minHeight: '400px' }} />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="page-container">
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <WarningOutlined style={{ fontSize: '48px', color: '#faad14', marginBottom: '16px' }} />
            <h3>لم يتم العثور على الطلب</h3>
            <Button type="primary" onClick={() => navigate('/admin/events')}>
              العودة إلى قائمة الأحداث
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
                onClick={() => navigate('/admin/events')}
                size="large"
              />
              <h1 className="page-title" style={{ margin: 0 }}>
                طلب حدث خاص #{event.id.slice(-8)}
              </h1>
              <Badge
                status={
                  event.status === 'confirmed'
                    ? 'success'
                    : event.status === 'quoted' || event.status === 'paid' || event.status === 'submitted' || event.status === 'under_review' || event.status === 'invoiced'
                    ? 'processing'
                    : event.status === 'rejected'
                    ? 'error'
                    : 'default'
                }
                text={getStatusText(event.status)}
              />
            </Space>
            <p className="page-subtitle">
              <span style={{ fontSize: '18px', marginRight: '8px' }}>
                {getEventTypeIcon(event.type)}
              </span>
              {getEventTypeText(event.type)} - {event.persons} شخص
            </p>
          </div>
          <Space>
            {event.status === 'submitted' && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => setQuoteModalVisible(true)}
              >
                إرسال عرض سعر
              </Button>
            )}
            {event.status === 'paid' && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => setConfirmModalVisible(true)}
              >
                تأكيد الحدث
              </Button>
            )}
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Workflow Steps */}
          {event.status !== 'rejected' && (
            <Card className="custom-card" style={{ marginBottom: '24px' }}>
              <Steps
                current={getCurrentStep(event.status)}
                status={'process'}
                direction="horizontal"
                size="small"
              >
                <Step title="طلب مرسل" description="تم استلام الطلب" />
                <Step title="إرسال عرض" description="تحديد السعر والتفاصيل" />
                <Step title="تأكيد الدفع" description="استلام المبلغ" />
                <Step title="تأكيد الحدث" description="تأكيد نهائي للحجز" />
              </Steps>
            </Card>
          )}

          {event.status === 'rejected' && (
            <Alert
              message="تم رفض الطلب"
              type="error"
              showIcon
              style={{ marginBottom: '24px' }}
            />
          )}

          <Row gutter={[24, 24]}>
            {/* Customer Information */}
            <Col xs={24} lg={12}>
              <Card className="custom-card" title="معلومات العميل" extra={<UserOutlined />}>
                <Space size="large" style={{ width: '100%' }} direction="vertical">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#722ed1' }} />
                    <div>
                      <h3 style={{ margin: 0, marginBottom: '4px' }}>{event.requester.name}</h3>
                      <div style={{ color: '#8c8c8c', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MailOutlined />
                        {event.requester.email}
                      </div>
                      <div style={{ color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <PhoneOutlined />
                        {event.requester.phone}
                      </div>
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>

            {/* Event Type & Decoration */}
            <Col xs={24} lg={12}>
              <Card 
                className="custom-card" 
                title="نوع الحدث والتفاصيل" 
                extra={<span style={{ fontSize: '20px' }}>{getEventTypeIcon(event.type)}</span>}
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="نوع الحدث">
                    <Tag color="purple" style={{ fontSize: '14px', padding: '4px 12px' }}>
                      {getEventTypeText(event.type)}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="تزيين خاص">
                    <Tag color={event.decorated ? 'gold' : 'default'}>
                      {event.decorated ? '✨ مع تزيين خاص' : 'بدون تزيين خاص'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="عدد الأشخاص">
                    <Space>
                      <UserOutlined />
                      {event.persons} شخص
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="المدة">{event.durationHours} ساعات</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* Venue Information */}
            <Col xs={24} lg={12}>
              <Card className="custom-card" title="معلومات المكان" extra={<EnvironmentOutlined />}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="الفرع">
                    {event.branch?.name_ar || event.branch?.nameAr || 'غير محدد'}
                  </Descriptions.Item>
                  <Descriptions.Item label="العنوان">
                    {event.branch?.location || 'غير محدد'}
                  </Descriptions.Item>
                  {event.branch?.capacity && (
                    <Descriptions.Item label="السعة">
                      <Space>
                        <UserOutlined />
                        {event.branch.capacity} شخص
                      </Space>
                    </Descriptions.Item>
                  )}
                </Descriptions>
                
                {event.branch?.amenities && event.branch.amenities.length > 0 && (
                  <>
                    <Divider />
                    <div style={{ marginBottom: '8px', fontWeight: '600' }}>المرافق المتاحة:</div>
                    <Space wrap>
                      {event.branch.amenities.map((amenity, index) => (
                        <Tag key={index} color="blue">{amenity}</Tag>
                      ))}
                    </Space>
                  </>
                )}
              </Card>
            </Col>

            {/* Event Schedule */}
            <Col xs={24} lg={12}>
              <Card className="custom-card" title="موعد الحدث" extra={<CalendarOutlined />}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#1890ff' }}>
                      {new Date(event.startTime).toLocaleDateString('ar-SA', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        calendar: 'gregory'
                      })}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '600', marginTop: '4px' }}>
                      {formatTimeAr(event.startTime)}
                    </div>
                    <div style={{ color: '#8c8c8c', marginTop: '4px' }}>
                      المدة: {event.durationHours} ساعات
                    </div>
                  </div>
                  
                  <Divider />
                  
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>وقت الانتهاء المتوقع:</div>
                    <div style={{ color: '#52c41a', fontWeight: '600' }}>
                      {formatTimeAr(
                        new Date(new Date(event.startTime).getTime() + event.durationHours * 60 * 60 * 1000)
                      )}
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>

            {/* Event Notes */}
            {event.notes && (
              <Col xs={24}>
                <Card className="custom-card" title="ملاحظات وطلبات خاصة">
                  <div style={{ 
                    padding: '16px', 
                    backgroundColor: '#f6ffed', 
                    border: '1px solid #b7eb8f',
                    borderRadius: '8px',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}>
                    {event.notes}
                  </div>
                </Card>
              </Col>
            )}

            {/* Add-ons & Pricing */}
            {((event.addOns && event.addOns.length > 0) || event.quotedPrice) && (
              <Col xs={24} lg={event.quotedPrice ? 16 : 24}>
                <Card className="custom-card" title="الخدمات الإضافية والتسعير" extra={<StarOutlined />}>
                  {event.addOns && event.addOns.length > 0 && (
                    <Space direction="vertical" style={{ width: '100%', marginBottom: event.quotedPrice ? '24px' : 0 }}>
                      <div style={{ fontWeight: '600', marginBottom: '12px' }}>الخدمات المطلوبة:</div>
                      {event.addOns.map((addon, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px',
                          backgroundColor: '#fafafa',
                          borderRadius: '8px',
                          border: '1px solid #f0f0f0'
                        }}>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '14px' }}>{addon.name}</div>
                            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                              الكمية: {addon.quantity} × {addon.price.toLocaleString()} ر.س
                            </div>
                          </div>
                          <div style={{ fontWeight: '600', color: '#52c41a', fontSize: '16px' }}>
                            {(addon.price * addon.quantity).toLocaleString()} ر.س
                          </div>
                        </div>
                      ))}
                    </Space>
                  )}

                  {event.quotedPrice && (
                    <>
                      {event.addOns && event.addOns.length > 0 && <Divider />}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '16px',
                        backgroundColor: '#e6f7ff',
                        borderRadius: '8px',
                        border: '2px solid #91d5ff'
                      }}>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: '600' }}>السعر الإجمالي المقترح</div>
                          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>شامل جميع الخدمات</div>
                        </div>
                        <div style={{ 
                          fontSize: '24px', 
                          fontWeight: 'bold',
                          color: '#1890ff'
                        }}>
                          {event.quotedPrice.toLocaleString()} ر.س
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              </Col>
            )}

            {/* Status Information */}
            {event.quotedPrice && (
              <Col xs={24} lg={8}>
                <Card className="custom-card" title="حالة الطلب" extra={<DollarOutlined />}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ textAlign: 'center', padding: '16px' }}>
                      <Tag 
                        color={getStatusColor(event.status)} 
                        style={{ 
                          fontSize: '16px', 
                          padding: '8px 16px',
                          borderRadius: '20px'
                        }}
                      >
                        {getStatusText(event.status)}
                      </Tag>
                    </div>
                    
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="تاريخ الإنشاء">
                        {new Date(event.createdAt).toLocaleDateString('ar-SA', { calendar: 'gregory' })}
                      </Descriptions.Item>
                      <Descriptions.Item label="آخر تحديث">
                        {new Date(event.updatedAt).toLocaleDateString('ar-SA', { calendar: 'gregory' })}
                      </Descriptions.Item>
                      {event.paymentMethod && (
                        <Descriptions.Item label="طريقة الدفع">
                          {event.paymentMethod === 'cash' ? 'نقدي' : 
                           event.paymentMethod === 'card' ? 'بطاقة ائتمان' : 
                           event.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 
                           event.paymentMethod}
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </Space>
                </Card>
              </Col>
            )}

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

      {/* Quote Modal */}
      <Modal
        title="إرسال عرض سعر للحدث"
        open={quoteModalVisible}
        onCancel={() => setQuoteModalVisible(false)}
        footer={null}
        destroyOnClose
        width={600}
      >
        <Form
          form={quoteForm}
          layout="vertical"
          onFinish={handleQuote}
        >
          <Form.Item
            label="السعر المقترح (ريال سعودي)"
            name="quotedPrice"
            rules={[{ required: true, message: 'يرجى إدخال السعر المقترح' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value: any) => value?.replace(/\$\s?|(,*)/g, '')}
              placeholder="0"
            />
          </Form.Item>

          <Form.Item
            label="ملاحظات العرض"
            name="notes"
          >
            <Input.TextArea
              rows={4}
              placeholder="أضف تفاصيل العرض أو ملاحظات خاصة..."
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'left' }}>
            <Space>
              <Button onClick={() => setQuoteModalVisible(false)}>
                إلغاء
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={actionLoading}
                icon={<FileTextOutlined />}
              >
                إرسال العرض
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        title="تأكيد الحدث"
        open={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        onOk={handleConfirm}
        okText="تأكيد الحدث"
        cancelText="إلغاء"
        confirmLoading={actionLoading}
      >
        <p>هل أنت متأكد من تأكيد هذا الحدث؟ سيتم إرسال تأكيد نهائي للعميل.</p>
      </Modal>
    </div>
  )
}


