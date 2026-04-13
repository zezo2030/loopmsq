import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Descriptions, Empty, Space, Table, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { apiGet } from '../../api'

const { Title, Text } = Typography

type Detail = {
  id: string
  status: string
  paymentStatus: string
  subtotal: number
  addonsTotal: number
  totalPrice: number
  selectedAddOns: Array<{ id: string; name: string; quantity: number; price: number }>
  contactPhone: string
  createdAt: string
  updatedAt: string
  ticketsCount: number
  tickets: Array<{ id: string; ticketKind: string; status: string; createdAt: string; scannedAt?: string; startedAt?: string; expiresAt?: string }>
  user: { name: string; phone: string; email: string }
  branch: { name: string }
  offer: { title: string; category: string; price: number; currency: string; description?: string | null }
}

export default function OfferBookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)

  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString('ar-SA') : '-')
  const formatCurrency = (value: number, currency = 'SAR') => `${new Intl.NumberFormat('ar-SA').format(value || 0)} ${currency}`

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true)
      try {
        setData(await apiGet<Detail>(`/offer-bookings/admin/all/${id}`))
      } catch {
        message.error('تعذر تحميل تفاصيل حجز العرض')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (!loading && !data) return <Card><Empty description="لم يتم العثور على الحجز" /></Card>

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-content">
          <Space direction="vertical" size={4}>
            <Space>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/finance/offer-bookings')} />
              <Title level={2} style={{ margin: 0 }}>تفاصيل حجز العرض</Title>
            </Space>
            <Text type="secondary">عرض كامل لبيانات الحجز والتذاكر والإضافات.</Text>
          </Space>
        </div>
      </div>
      <div className="page-content">
        <div className="page-content-inner">
          <Card loading={loading}>
            {data && (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="المعرف">{data.id}</Descriptions.Item>
                  <Descriptions.Item label="العميل">{data.user.name}</Descriptions.Item>
                  <Descriptions.Item label="الهاتف">{data.user.phone || data.contactPhone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="البريد">{data.user.email || '-'}</Descriptions.Item>
                  <Descriptions.Item label="الفرع">{data.branch.name}</Descriptions.Item>
                  <Descriptions.Item label="العرض">{data.offer.title}</Descriptions.Item>
                  <Descriptions.Item label="نوع العرض">{data.offer.category}</Descriptions.Item>
                  <Descriptions.Item label="السعر الأساسي">{formatCurrency(data.subtotal, data.offer.currency)}</Descriptions.Item>
                  <Descriptions.Item label="الإضافات">{formatCurrency(data.addonsTotal, data.offer.currency)}</Descriptions.Item>
                  <Descriptions.Item label="الإجمالي">{formatCurrency(data.totalPrice, data.offer.currency)}</Descriptions.Item>
                  <Descriptions.Item label="عدد التذاكر">{data.ticketsCount}</Descriptions.Item>
                  <Descriptions.Item label="حالة الحجز"><Tag>{data.status}</Tag></Descriptions.Item>
                  <Descriptions.Item label="حالة الدفع"><Tag color={data.paymentStatus === 'completed' ? 'blue' : 'gold'}>{data.paymentStatus}</Tag></Descriptions.Item>
                  <Descriptions.Item label="تاريخ الإنشاء">{formatDate(data.createdAt)}</Descriptions.Item>
                  <Descriptions.Item label="آخر تحديث">{formatDate(data.updatedAt)}</Descriptions.Item>
                  <Descriptions.Item label="الوصف" span={2}>{data.offer.description || 'لا يوجد وصف'}</Descriptions.Item>
                  <Descriptions.Item label="الإضافات المختارة" span={2}>
                    {data.selectedAddOns?.length ? data.selectedAddOns.map((item) => `${item.name} × ${item.quantity}`).join('، ') : 'لا توجد إضافات'}
                  </Descriptions.Item>
                </Descriptions>

                <Card title="التذاكر">
                  <Table
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    dataSource={data.tickets || []}
                    columns={[
                      { title: 'المعرف', dataIndex: 'id' },
                      { title: 'النوع', dataIndex: 'ticketKind' },
                      { title: 'الحالة', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
                      { title: 'الإنشاء', dataIndex: 'createdAt', render: (value: string) => formatDate(value) },
                      { title: 'المسح', dataIndex: 'scannedAt', render: (value?: string) => formatDate(value) },
                      { title: 'الانتهاء', dataIndex: 'expiresAt', render: (value?: string) => formatDate(value) },
                    ]}
                    locale={{ emptyText: <Empty description="لا توجد تذاكر لهذا الحجز" /> }}
                  />
                </Card>
              </Space>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
