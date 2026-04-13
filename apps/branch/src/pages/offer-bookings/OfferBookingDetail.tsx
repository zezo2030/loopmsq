import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Descriptions, Empty, Space, Table, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { apiGet } from '../../api'

const { Title, Text } = Typography

export default function OfferBookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString('ar-SA') : '-')
  const formatCurrency = (value: number, currency = 'SAR') => `${new Intl.NumberFormat('ar-SA').format(value || 0)} ${currency}`

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true)
      try {
        setData(await apiGet(`/offer-bookings/branch/me/${id}`))
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
      <div className="page-header"><div className="page-header-content"><Space direction="vertical" size={4}><Space><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/offer-bookings')} /><Title level={2} style={{ margin: 0 }}>تفاصيل حجز العرض</Title></Space><Text type="secondary">بيانات الحجز والتذاكر داخل الفرع.</Text></Space></div></div>
      <div className="page-content"><div className="page-content-inner"><Card loading={loading}>{data && <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="المعرف">{data.id}</Descriptions.Item>
          <Descriptions.Item label="العميل">{data.user?.name}</Descriptions.Item>
          <Descriptions.Item label="العرض">{data.offer?.title}</Descriptions.Item>
          <Descriptions.Item label="النوع">{data.offer?.category}</Descriptions.Item>
          <Descriptions.Item label="الإجمالي">{formatCurrency(Number(data.totalPrice || 0), data.offer?.currency || 'SAR')}</Descriptions.Item>
          <Descriptions.Item label="عدد التذاكر">{data.ticketsCount || 0}</Descriptions.Item>
          <Descriptions.Item label="الحالة"><Tag>{data.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="الدفع"><Tag>{data.paymentStatus}</Tag></Descriptions.Item>
          <Descriptions.Item label="تاريخ الإنشاء">{formatDate(data.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="آخر تحديث">{formatDate(data.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="الإضافات" span={2}>{data.selectedAddOns?.length ? data.selectedAddOns.map((item: any) => `${item.name} × ${item.quantity}`).join('، ') : 'لا توجد إضافات'}</Descriptions.Item>
        </Descriptions>
        <Card title="التذاكر">
          <Table rowKey="id" dataSource={data.tickets || []} pagination={{ pageSize: 10 }} columns={[
            { title: 'المعرف', dataIndex: 'id' },
            { title: 'النوع', dataIndex: 'ticketKind' },
            { title: 'الحالة', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
            { title: 'الإنشاء', dataIndex: 'createdAt', render: (value: string) => formatDate(value) },
            { title: 'الانتهاء', dataIndex: 'expiresAt', render: (value?: string) => formatDate(value) },
          ]} />
        </Card>
      </Space>}</Card></div></div>
    </div>
  )
}
