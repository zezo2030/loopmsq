import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Descriptions, Empty, Space, Table, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { apiGet } from '../../api'

const { Title, Text } = Typography

export default function SubscriptionDetail() {
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
        setData(await apiGet(`/subscription-purchases/branch/me/${id}`))
      } catch {
        message.error('تعذر تحميل تفاصيل الاشتراك')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (!loading && !data) return <Card><Empty description="لم يتم العثور على الاشتراك" /></Card>

  return (
    <div className="page-container">
      <div className="page-header"><div className="page-header-content"><Space direction="vertical" size={4}><Space><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/subscriptions')} /><Title level={2} style={{ margin: 0 }}>تفاصيل الاشتراك</Title></Space><Text type="secondary">بيانات الاشتراك الكاملة داخل الفرع.</Text></Space></div></div>
      <div className="page-content"><div className="page-content-inner"><Card loading={loading}>{data && <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="المعرف">{data.id}</Descriptions.Item>
          <Descriptions.Item label="العميل">{data.user?.name}</Descriptions.Item>
          <Descriptions.Item label="الهاتف">{data.user?.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="الخطة">{data.plan?.title}</Descriptions.Item>
          <Descriptions.Item label="السعر">{formatCurrency(Number(data.plan?.price || 0), data.plan?.currency || 'SAR')}</Descriptions.Item>
          <Descriptions.Item label="إجمالي الساعات">{data.totalHours ?? 'غير محدود'}</Descriptions.Item>
          <Descriptions.Item label="المتبقي">{data.remainingHours ?? 'غير محدود'}</Descriptions.Item>
          <Descriptions.Item label="الحد اليومي">{data.dailyHoursLimit ?? 'غير محدود'}</Descriptions.Item>
          <Descriptions.Item label="الحالة"><Tag>{data.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="الدفع"><Tag>{data.paymentStatus}</Tag></Descriptions.Item>
          <Descriptions.Item label="البداية">{formatDate(data.startedAt)}</Descriptions.Item>
          <Descriptions.Item label="النهاية">{formatDate(data.endsAt)}</Descriptions.Item>
        </Descriptions>
        <Card title="سجل الاستخدام">
          <Table rowKey="id" dataSource={data.usageLogs || []} pagination={{ pageSize: 10 }} columns={[
            { title: 'الموظف', dataIndex: 'staffName' },
            { title: 'الساعات المخصومة', dataIndex: 'deductedHours' },
            { title: 'المتبقي', dataIndex: 'remainingHoursAfter' },
            { title: 'التاريخ', dataIndex: 'createdAt', render: (value: string) => formatDate(value) },
          ]} />
        </Card>
      </Space>}</Card></div></div>
    </div>
  )
}
