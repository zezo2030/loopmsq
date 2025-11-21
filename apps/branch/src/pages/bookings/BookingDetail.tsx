import { Card, Descriptions, Tag, Button, Space, Divider, Typography, Row, Col, Statistic, Modal } from 'antd'
import { CloseOutlined, UserOutlined, CalendarOutlined, DollarOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'

const { Title, Text } = Typography

interface BookingDetailProps {
  booking: any
  onClose: () => void
  onCancel: (bookingId: string) => void
}

export default function BookingDetail({ booking, onClose, onCancel }: BookingDetailProps) {
  const { t } = useTranslation()
  const [showCancelModal, setShowCancelModal] = useState(false)

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
                {booking.user?.phone || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Hall Information */}
        <Col xs={24} lg={12}>
          <Card className="custom-card">
            <Title level={5} style={{ marginBottom: '16px' }}>
              <CalendarOutlined style={{ marginRight: '8px' }} />
              {t('bookings.hall_info') || 'Hall Information'}
            </Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('bookings.hall_name') || 'Hall Name'}>
                {booking.hall?.nameAr || booking.hall?.nameEn || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('bookings.branch_name') || 'Branch'}>
                {booking.hall?.branch?.nameAr || booking.hall?.branch?.nameEn || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('bookings.hall_capacity') || 'Capacity'}>
                {booking.hall?.capacity || '-'} {t('halls.persons') || 'persons'}
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
              value={booking.startTime ? new Date(booking.startTime).toLocaleString('ar-SA', { calendar: 'gregory' }) : '-'}
              valueStyle={{ fontSize: '16px' }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Statistic
              title={t('bookings.end_time') || 'End Time'}
              value={booking.endTime ? new Date(booking.endTime).toLocaleString('ar-SA', { calendar: 'gregory' }) : '-'}
              valueStyle={{ fontSize: '16px' }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Statistic
              title={t('bookings.duration') || 'Duration'}
              value={booking.duration || '-'}
              suffix={t('bookings.hours') || 'hours'}
              valueStyle={{ fontSize: '16px' }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Statistic
              title={t('bookings.persons') || 'Persons'}
              value={booking.persons || '-'}
              suffix={t('bookings.people') || 'people'}
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
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Statistic
              title={t('bookings.base_amount') || 'Base Amount'}
              value={booking.baseAmount || 0}
              suffix="SAR"
              valueStyle={{ fontSize: '18px', color: '#3b82f6' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title={t('bookings.add_ons') || 'Add-ons'}
              value={booking.addOnsAmount || 0}
              suffix="SAR"
              valueStyle={{ fontSize: '18px', color: '#10b981' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title={t('bookings.total_amount') || 'Total Amount'}
              value={booking.amount || 0}
              suffix="SAR"
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
