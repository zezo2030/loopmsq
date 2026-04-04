import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Form,
  Input,
  Button,
  DatePicker,
  InputNumber,
  Select,
  message,
  Space,
  Row,
  Col,
  Typography,
  Alert,
} from 'antd'
import {
  GiftOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import { apiGet, apiPost } from '../../api'
import { useBranchAuth } from '../../auth'
import { useTranslation } from 'react-i18next'
import '../../theme.css'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

type User = {
  id: string
  name: string
  email?: string
  phone?: string
}

type Hall = {
  id: string
  name: string
  capacity?: number
}

export default function CreateFreeTicket() {
  const navigate = useNavigate()
  const { me } = useBranchAuth()
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [halls, setHalls] = useState<Hall[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingHalls, setLoadingHalls] = useState(false)

  useEffect(() => {
    loadUsers()
    loadHalls()
  }, [])

  const loadUsers = async () => {
    if (!me?.branchId) return
    setLoadingUsers(true)
    try {
      // Load users - branch manager can only see users in their branch
      const response = await apiGet<{ users: User[] }>('/users?limit=100')
      setUsers(response.users || [])
    } catch (error: any) {
      console.error('Failed to load users:', error)
      message.error(t('free_ticket.load_users_failed') || 'فشل تحميل قائمة المستخدمين')
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadHalls = async () => {
    if (!me?.branchId) return
    setLoadingHalls(true)
    try {
      const response = await apiGet<Hall[]>(`/content/branches/${me.branchId}/halls`)
      setHalls(response || [])
    } catch (error: any) {
      console.error('Failed to load halls:', error)
      message.error(t('free_ticket.load_halls_failed') || 'فشل تحميل قائمة القاعات')
    } finally {
      setLoadingHalls(false)
    }
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const payload = {
        userId: values.userId,
        hallId: values.hallId || undefined,
        startTime: values.startTime.toISOString(),
        durationHours: values.durationHours,
        persons: values.persons,
        notes: values.notes || undefined,
      }

      const result = await apiPost('/bookings/free-ticket', payload)
      message.success(`${t('free_ticket.success', { count: result.tickets.length })}`)
      navigate('/bookings')
    } catch (error: any) {
      const errorMessage = error?.message || t('free_ticket.failed') || 'فشل إنشاء التذكرة المجانية'
      message.error(errorMessage)
      console.error('Failed to create free ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
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
              <Title level={2} style={{ margin: 0 }}>
                {t('free_ticket.title') || 'إنشاء تذكرة مجانية'}
              </Title>
            </Space>
            <Text type="secondary">
              {t('free_ticket.subtitle') || 'يمكنك إنشاء تذاكر مجانية للمستخدمين في فرعك فقط'}
            </Text>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <Alert
            message={t('free_ticket.alert_title') || 'تذكرة مجانية'}
            description={t('free_ticket.alert_desc') || 'سيتم إنشاء حجز مجاني (سعر 0) مع تذاكر صالحة للمستخدم المحدد. التذاكر ستكون للفرع الخاص بك فقط.'}
            type="info"
            showIcon
            style={{ marginBottom: '24px' }}
          />

          <Card className="custom-card">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                durationHours: 2,
                persons: 1,
              }}
            >
              <Row gutter={24}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    label={
                      <Space>
                        <UserOutlined />
                        <span>{t('free_ticket.user') || 'المستخدم'}</span>
                      </Space>
                    }
                    name="userId"
                    rules={[{ required: true, message: t('free_ticket.user_required') || 'يرجى اختيار المستخدم' }]}
                  >
                    <Select
                      placeholder={t('free_ticket.user_ph') || 'اختر المستخدم'}
                      loading={loadingUsers}
                      showSearch
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={users.map((user) => ({
                        value: user.id,
                        label: `${user.name}${user.email ? ` (${user.email})` : ''}`,
                      }))}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} lg={12}>
                  <Form.Item
                    label={
                      <Space>
                        <CalendarOutlined />
                        <span>{t('free_ticket.hall') || 'القاعة (اختياري)'}</span>
                      </Space>
                    }
                    name="hallId"
                  >
                    <Select
                      placeholder={t('free_ticket.hall_ph') || 'اختر القاعة (اختياري)'}
                      loading={loadingHalls}
                      allowClear
                      options={halls.map((hall) => ({
                        value: hall.id,
                        label: `${hall.name}${hall.capacity ? ` (${t('halls.capacity') || 'سعة'}: ${hall.capacity})` : ''}`,
                      }))}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} lg={12}>
                  <Form.Item
                    label={
                      <Space>
                        <CalendarOutlined />
                        <span>{t('free_ticket.start_time') || 'تاريخ ووقت البداية'}</span>
                      </Space>
                    }
                    name="startTime"
                    rules={[{ required: true, message: t('free_ticket.start_time_required') || 'يرجى اختيار تاريخ ووقت البداية' }]}
                  >
                    <DatePicker
                      showTime={{ use12Hours: true }}
                      format="YYYY-MM-DD h:mm A"
                      style={{ width: '100%' }}
                      disabledDate={(current) => current && current < dayjs().startOf('day')}
                      placeholder={t('free_ticket.start_time_ph') || 'اختر التاريخ والوقت'}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} lg={12}>
                  <Form.Item
                    label={
                      <Space>
                        <ClockCircleOutlined />
                        <span>{t('free_ticket.duration') || 'المدة (ساعات)'}</span>
                      </Space>
                    }
                    name="durationHours"
                    rules={[
                      { required: true, message: t('free_ticket.duration_required') || 'يرجى إدخال المدة' },
                      { type: 'number', min: 1, max: 12, message: t('free_ticket.duration_range') || 'المدة يجب أن تكون بين 1 و 12 ساعة' },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      max={12}
                      placeholder={t('free_ticket.duration_ph') || 'عدد الساعات'}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} lg={12}>
                  <Form.Item
                    label={
                      <Space>
                        <TeamOutlined />
                        <span>{t('free_ticket.persons') || 'عدد الأشخاص (عدد التذاكر)'}</span>
                      </Space>
                    }
                    name="persons"
                    rules={[
                      { required: true, message: t('free_ticket.persons_required') || 'يرجى إدخال عدد الأشخاص' },
                      { type: 'number', min: 1, message: t('free_ticket.persons_min') || 'يجب أن يكون العدد على الأقل 1' },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      placeholder={t('free_ticket.persons_ph') || 'عدد الأشخاص'}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    label={t('free_ticket.notes') || 'ملاحظات (اختياري)'}
                    name="notes"
                  >
                    <TextArea
                      rows={4}
                      placeholder={t('free_ticket.notes_ph') || 'أضف أي ملاحظات أو طلبات خاصة...'}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: '24px', textAlign: 'left' }}>
                <Space>
                  <Button onClick={() => navigate('/bookings')}>
                    {t('free_ticket.cancel') || 'إلغاء'}
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<GiftOutlined />}
                    loading={loading}
                    size="large"
                  >
                    {t('free_ticket.submit') || 'إنشاء تذكرة مجانية'}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  )
}

