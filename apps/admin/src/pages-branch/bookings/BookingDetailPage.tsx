import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Empty, Space, Typography, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { apiGet, apiPatch } from '../../shared/api'
import BookingDetail from './BookingDetail'

const { Title, Text } = Typography

export default function BranchBookingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      navigate('/branch/bookings', { replace: true })
      return
    }
    loadBooking()
  }, [id, navigate])

  async function loadBooking() {
    setLoading(true)
    try {
      const data = await apiGet(`/bookings/${id}`)
      setBooking(data)
    } catch {
      message.error(t('bookings.load_failed') || 'تعذر تحميل الحجز')
      setBooking(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(bookingId: string) {
    try {
      await apiPatch(`/bookings/${bookingId}/cancel`, {})
      message.success(t('bookings.cancelled') || 'تم إلغاء الحجز')
      navigate('/branch/bookings')
    } catch {
      message.error(t('bookings.cancel_failed') || 'فشل إلغاء الحجز')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-content">
          <Space direction="vertical" size={4}>
            <Space>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/branch/bookings')}
              />
              <Title level={2} style={{ margin: 0 }}>
                {t('bookings.booking_details') || 'تفاصيل الحجز'}
              </Title>
            </Space>
            <Text type="secondary">
              {t('bookings.view_and_manage') || 'عرض وإدارة بيانات الحجز داخل الفرع'}
            </Text>
          </Space>
        </div>
      </div>
      <div className="page-content">
        <div className="page-content-inner">
          <Card loading={loading}>
            {!loading && !booking ? (
              <Empty description={t('bookings.not_found') || 'لم يتم العثور على الحجز'} />
            ) : (
              booking && (
                <BookingDetail
                  booking={booking}
                  onClose={() => navigate('/branch/bookings')}
                  onCancel={handleCancel}
                />
              )
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
