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
  totalHours: number | null
  remainingHours: number | null
  dailyHoursLimit: number | null
  startedAt: string
  endsAt: string
  createdAt: string
  updatedAt: string
  user: { name: string; phone: string; email: string }
  branch: { name: string }
  plan: { title: string; usageMode: string; durationMonths: number | null; price: number; currency: string; description?: string | null }
  usageLogs: Array<{ id: string; staffName: string; deductedHours: number; remainingHoursAfter: number; createdAt: string; notes?: string }>
}

export default function SubscriptionDetail() {
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
        setData(await apiGet<Detail>(`/subscription-purchases/admin/all/${id}`))
      } catch {
        message.error('تعذر تحميل تفاصيل الاشتراك')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (!loading && !data) {
    return <Card><Empty description="لم يتم العثور على الاشتراك" /></Card>
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-content">
          <Space direction="vertical" size={4}>
            <Space>
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/finance/subscriptions')} />
              <Title level={2} style={{ margin: 0 }}>تفاصيل الاشتراك</Title>
            </Space>
            <Text type="secondary">عرض كامل لبيانات الاشتراك وسجل الاستهلاك.</Text>
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
                  <Descriptions.Item label="الهاتف">{data.user.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="البريد">{data.user.email || '-'}</Descriptions.Item>
                  <Descriptions.Item label="الفرع">{data.branch.name}</Descriptions.Item>
                  <Descriptions.Item label="الخطة">{data.plan.title}</Descriptions.Item>
                  <Descriptions.Item label="السعر">{formatCurrency(data.plan.price, data.plan.currency)}</Descriptions.Item>
                  <Descriptions.Item label="مدة الاشتراك">{data.plan.durationMonths ? `${data.plan.durationMonths} شهر` : '-'}</Descriptions.Item>
                  <Descriptions.Item label="إجمالي الساعات">{data.totalHours ?? 'غير محدود'}</Descriptions.Item>
                  <Descriptions.Item label="المتبقي">{data.remainingHours ?? 'غير محدود'}</Descriptions.Item>
                  <Descriptions.Item label="الحد اليومي">{data.dailyHoursLimit ?? 'غير محدود'}</Descriptions.Item>
                  <Descriptions.Item label="نوع الاستخدام">{data.plan.usageMode}</Descriptions.Item>
                  <Descriptions.Item label="حالة الاشتراك"><Tag>{data.status}</Tag></Descriptions.Item>
                  <Descriptions.Item label="حالة الدفع"><Tag color={data.paymentStatus === 'completed' ? 'blue' : 'gold'}>{data.paymentStatus}</Tag></Descriptions.Item>
                  <Descriptions.Item label="البداية">{formatDate(data.startedAt)}</Descriptions.Item>
                  <Descriptions.Item label="النهاية">{formatDate(data.endsAt)}</Descriptions.Item>
                  <Descriptions.Item label="تاريخ الإنشاء">{formatDate(data.createdAt)}</Descriptions.Item>
                  <Descriptions.Item label="آخر تحديث">{formatDate(data.updatedAt)}</Descriptions.Item>
                  <Descriptions.Item label="الوصف" span={2}>{data.plan.description || 'لا يوجد وصف'}</Descriptions.Item>
                </Descriptions>

                <Card title="سجل الاستخدام">
                  <Table
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    dataSource={data.usageLogs || []}
                    columns={[
                      { title: 'الموظف', dataIndex: 'staffName' },
                      { title: 'الساعات المخصومة', dataIndex: 'deductedHours' },
                      { title: 'المتبقي بعد الخصم', dataIndex: 'remainingHoursAfter' },
                      { title: 'التاريخ', dataIndex: 'createdAt', render: (value: string) => formatDate(value) },
                      { title: 'ملاحظات', dataIndex: 'notes', render: (value?: string) => value || '-' },
                    ]}
                    locale={{ emptyText: <Empty description="لا يوجد سجل استخدام بعد" /> }}
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
