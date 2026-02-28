import { Card, Descriptions, Tag, Button, Space, Typography, Row, Col, Statistic, Modal } from 'antd'
import { CloseOutlined, UserOutlined, CalendarOutlined, DollarOutlined, IdcardOutlined, ReloadOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { apiGet } from '../../shared/api'

const { Title, Text } = Typography

interface BookingDetailProps {
  booking: any
  onClose: () => void
  onCancel: (bookingId: string) => void
}

type Ticket = {
  id: string
  status: 'valid' | 'used' | 'expired' | 'cancelled'
  holderName?: string
  validFrom?: string
  validUntil?: string
  scannedAt?: string
}

export default function BookingDetail({ booking, onClose, onCancel }: BookingDetailProps) {
  const { t } = useTranslation()
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  // Derived values for correct display
  const start = booking?.startTime ? new Date(booking.startTime) : null
  const durationHrs = Number(booking?.durationHours ?? booking?.duration ?? 0)
  const end = start && Number.isFinite(durationHrs)
    ? new Date(start.getTime() + durationHrs * 3600_000)
    : (booking?.endTime ? new Date(booking.endTime) : null)
  const toArLocale = (d?: Date | null) => (d ? d.toLocaleString('ar-SA', { calendar: 'gregory' }) : '-')
  const displayName = (o?: any) => o?.name ?? o?.name_ar ?? o?.nameAr ?? o?.name_en ?? o?.nameEn ?? ''
  const formatPhone = (v?: string) => {
    if (!v) return '-'
    const digits = (v.match(/\d+/g) || []).join('')
    if (digits.length < 6) return '-'
    const head = digits.slice(0, 2)
    const tail = digits.slice(-3)
    return `${head}${'x'.repeat(Math.max(0, digits.length - 5))}${tail}`
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

  const handleCancel = () => {
    setShowCancelModal(true)
  }

  const confirmCancel = () => {
    onCancel(booking.id)
    setShowCancelModal(false)
    onClose()
  }

  const canShowTickets = booking?.status === 'confirmed' || booking?.status === 'completed'

  useEffect(() => {
    if (!canShowTickets || !booking?.id) {
      setTickets([])
      return
    }
    loadTickets()
  }, [booking?.id, booking?.status])

  async function loadTickets() {
    if (!booking?.id) return
    setLoadingTickets(true)
    try {
      const data = await apiGet<Ticket[]>(`/bookings/${booking.id}/tickets`)
      setTickets(data || [])
    } catch (error) {
      console.error('Failed to load booking tickets:', error)
      setTickets([])
    } finally {
      setLoadingTickets(false)
    }
  }

  return (
    <div>
      {/* Booking Information */}
      <Card className="custom-card" style={{ marginBottom: '16px' }}>
        <Title level={4} style={{ marginBottom: '16px' }}>
          {t('bookings.booking_info') || 'Booking Information'}
        </Title>
        <Descriptions column={2} size="small">
          <Descriptions.Item label={t('bookings.id') || 'Booking ID'}>
            #{booking.id}
          </Descriptions.Item>
          <Descriptions.Item label={t('bookings.status') || 'Status'}>
            <Tag color={getStatusColor(booking.status)}>
              {t(`bookings.status_${booking.status}`) || booking.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('bookings.created_at') || 'Created At'}>
            {booking.createdAt ? new Date(booking.createdAt).toLocaleString('ar-SA', { calendar: 'gregory' }) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('bookings.updated_at') || 'Updated At'}>
            {booking.updatedAt ? new Date(booking.updatedAt).toLocaleString('ar-SA', { calendar: 'gregory' }) : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={[16, 16]}>
        {/* User Information */}
        <Col xs={24} lg={12}>
          <Card className="custom-card">
            <Title level={5} style={{ marginBottom: '16px' }}>
              <UserOutlined style={{ marginRight: '8px' }} />
              {t('bookings.user_info') || 'User Information'}
            </Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('bookings.user_name') || 'Name'}>
                {booking.user?.name || t('bookings.unnamed_user') || 'Unnamed User'}
              </Descriptions.Item>
              <Descriptions.Item label={t('bookings.user_email') || 'Email'}>
                {booking.user?.email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('bookings.user_phone') || 'Phone'}>
                {formatPhone(booking.user?.phone || booking.contactPhone)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Branch Information */}
        <Col xs={24} lg={12}>
          <Card className="custom-card">
            <Title level={5} style={{ marginBottom: '16px' }}>
              <CalendarOutlined style={{ marginRight: '8px' }} />
              {t('bookings.branch_info') || 'معلومات الفرع'}
            </Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('bookings.branch_name') || 'Branch'}>
                {displayName(booking.branch || booking.hall?.branch) || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('bookings.address') || 'العنوان'}>
                {(booking.branch as any)?.address || (booking.branch as any)?.location || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* Booking Details */}
      <Card className="custom-card" style={{ marginTop: '16px' }}>
        <Title level={5} style={{ marginBottom: '16px' }}>
          <CalendarOutlined style={{ marginRight: '8px' }} />
          {t('bookings.booking_details') || 'Booking Details'}
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Statistic
              title={t('bookings.start_time') || 'Start Time'}
              value={toArLocale(start)}
              valueStyle={{ fontSize: '16px' }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Statistic
              title={t('bookings.end_time') || 'End Time'}
              value={toArLocale(end)}
              valueStyle={{ fontSize: '16px' }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Statistic
              title={t('bookings.duration') || 'Duration'}
              value={Number.isFinite(durationHrs) && durationHrs > 0 ? durationHrs : '-'}
              suffix={` ${t('bookings.hours') || 'ساعات'}`}
              valueStyle={{ fontSize: '16px' }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Statistic
              title={t('bookings.persons') || 'Persons'}
              value={booking.persons || '-'}
              suffix={` ${t('bookings.people') || 'people'}`}
              valueStyle={{ fontSize: '16px' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Payment Information */}
      <Card className="custom-card" style={{ marginTop: '16px' }}>
        <Title level={5} style={{ marginBottom: '16px' }}>
          <DollarOutlined style={{ marginRight: '8px' }} />
          {t('bookings.payment_info') || 'Payment Information'}
        </Title>
        
        {/* Detailed Pricing Breakdown */}
        {booking.pricing && (
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1890ff' }}>
              تفصيل التسعير
            </div>
            <Row gutter={[16, 8]}>
              <Col xs={24} sm={12}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>السعر الأساسي:</span>
                  <span style={{ fontWeight: '500' }}>{booking.pricing.basePrice?.toLocaleString() || 0} ر.س</span>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>السعر بالساعة:</span>
                  <span style={{ fontWeight: '500' }}>{booking.pricing.hourlyPrice?.toLocaleString() || 0} ر.س</span>
                </div>
              </Col>
              {booking.pricing.pricePerPerson > 0 && (
                <>
                  <Col xs={24} sm={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>السعر لكل شخص:</span>
                      <span style={{ fontWeight: '500', color: '#52c41a' }}>
                        {booking.pricing.pricePerPerson?.toLocaleString() || 0} ر.س
                      </span>
                    </div>
                  </Col>
                  <Col xs={24} sm={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>إجمالي سعر الأشخاص:</span>
                      <span style={{ fontWeight: '500', color: '#52c41a' }}>
                        {booking.pricing.personsPrice?.toLocaleString() || 0} ر.س
                      </span>
                    </div>
                  </Col>
                </>
              )}
              {booking.pricing.decorationPrice > 0 && (
                <Col xs={24} sm={12}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>سعر الديكور:</span>
                    <span style={{ fontWeight: '500' }}>{booking.pricing.decorationPrice?.toLocaleString() || 0} ر.س</span>
                  </div>
                </Col>
              )}
              {booking.pricing.multiplier !== 1 && (
                <Col xs={24} sm={12}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>المضاعف:</span>
                    <span style={{ fontWeight: '500', color: '#fa8c16' }}>
                      × {booking.pricing.multiplier || 1}
                    </span>
                  </div>
                </Col>
              )}
            </Row>
          </div>
        )}
        
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Statistic
              title={t('bookings.base_amount') || 'Base Amount'}
              value={booking.baseAmount || booking.pricing?.basePrice || 0}
              suffix=" SAR"
              valueStyle={{ fontSize: '18px', color: '#3b82f6' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title={t('bookings.add_ons') || 'Add-ons'}
              value={booking.addOnsAmount || 0}
              suffix=" SAR"
              valueStyle={{ fontSize: '18px', color: '#10b981' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title={t('bookings.total_amount') || 'Total Amount'}
              value={booking.amount || booking.totalPrice || 0}
              suffix=" SAR"
              valueStyle={{ fontSize: '20px', color: '#ef4444', fontWeight: 'bold' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Add-ons */}
      {booking.addOns && booking.addOns.length > 0 && (
        <Card className="custom-card" style={{ marginTop: '16px' }}>
          <Title level={5} style={{ marginBottom: '16px' }}>
            {t('bookings.add_ons') || 'Add-ons'}
          </Title>
          <div>
            {booking.addOns.map((addon: any, index: number) => (
              <div key={index} style={{ 
                padding: '8px 12px', 
                margin: '4px 0', 
                background: '#f5f5f5', 
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <Text strong>{addon.name}</Text>
                  {addon.description && (
                    <div style={{ fontSize: '12px', color: '#666' }}>{addon.description}</div>
                  )}
                </div>
                <Text strong>{addon.price} SAR</Text>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tickets */}
      {canShowTickets && (
        <Card className="custom-card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <Title level={5} style={{ marginBottom: 0 }}>
              <IdcardOutlined style={{ marginRight: '8px' }} />
              التذاكر ({tickets.length})
            </Title>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadTickets}
              loading={loadingTickets}
              size="small"
            >
              تحديث
            </Button>
          </div>
          {loadingTickets ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#8c8c8c' }}>
              جاري تحميل التذاكر...
            </div>
          ) : tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#8c8c8c' }}>
              لا توجد تذاكر متاحة
            </div>
          ) : (
            <Row gutter={[12, 12]}>
              {tickets.map((ticket) => (
                <Col xs={24} sm={12} key={ticket.id}>
                  <Card size="small" style={{ border: '1px solid #f0f0f0' }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={4}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong>{ticket.holderName || `تذكرة #${ticket.id.slice(-6)}`}</Text>
                        <Tag
                          color={
                            ticket.status === 'valid'
                              ? 'green'
                              : ticket.status === 'used'
                                ? 'blue'
                                : ticket.status === 'expired'
                                  ? 'red'
                                  : 'default'
                          }
                        >
                          {ticket.status === 'valid'
                            ? 'صالحة'
                            : ticket.status === 'used'
                              ? 'مستخدمة'
                              : ticket.status === 'expired'
                                ? 'منتهية'
                                : 'ملغية'}
                        </Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        ID: {ticket.id.slice(0, 8)}...
                      </Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      )}

      {/* Actions */}
      <div style={{ marginTop: '24px', textAlign: 'right' }}>
        <Space>
          <Button onClick={onClose}>
            {t('common.close') || 'Close'}
          </Button>
          {booking.status === 'confirmed' && (
            <Button 
              danger
              icon={<CloseOutlined />}
              onClick={handleCancel}
            >
              {t('bookings.cancel') || 'Cancel Booking'}
            </Button>
          )}
        </Space>
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        title={t('bookings.cancel_booking') || 'Cancel Booking'}
        open={showCancelModal}
        onOk={confirmCancel}
        onCancel={() => setShowCancelModal(false)}
        okText={t('common.yes') || 'Yes'}
        cancelText={t('common.no') || 'No'}
        okButtonProps={{ danger: true }}
      >
        <p>{t('bookings.cancel_confirmation') || 'Are you sure you want to cancel this booking? This action cannot be undone.'}</p>
      </Modal>
    </div>
  )
}


