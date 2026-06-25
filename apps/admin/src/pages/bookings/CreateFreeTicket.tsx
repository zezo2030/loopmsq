import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  message,
  Row,
  Col,
} from 'antd'
import {
  ArrowLeftOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { apiGet, apiPost } from '../../api'
import { useQuery } from '@tanstack/react-query'
import '../../theme.css'

const { TextArea } = Input

export default function CreateFreeTicket() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('')

  // Debounce the dropdown search so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedUserSearch(userSearch.trim()), 350)
    return () => window.clearTimeout(t)
  }, [userSearch])

  // Load clients (role 'user') with server-side search. The API caps limit at
  // 100 and search by name/email is done server-side, so we query on demand
  // instead of loading everyone up front and filtering on the client.
  const { data: users, isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['users', 'clients', debouncedUserSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', limit: '100', role: 'user' })
      if (debouncedUserSearch) params.set('q', debouncedUserSearch)
      const res = await apiGet<{ users: any[] }>(`/users?${params.toString()}`)
      return Array.isArray(res) ? res : (res.users || [])
    },
  })

  // Load branches
  const { data: branches, isLoading: branchesLoading } = useQuery<any[]>({
    queryKey: ['branches', 'for-select'],
    queryFn: async () => {
      const res = await apiGet<any>('/content/branches?includeInactive=true')
      return Array.isArray(res) ? res : (res.items || res.branches || [])
    },
  })

  const userOptions = (users || []).map((u: any) => ({
    label: `${u.name || u.email || 'غير محدد'} ${u.phone ? `(${u.phone})` : ''}`,
    value: u.id,
  }))

  const branchOptions = (branches || []).map((b: any) => ({
    label: `${b?.name_ar || b?.name_en || b?.name || ''} ${b?.location ? `- ${b.location}` : ''}`,
    value: b.id,
  }))

  async function handleSubmit(values: any) {
    setLoading(true)
    try {
      // Free tickets are date-less: only a duration is needed. The ticket is
      // valid from its first scan for the chosen number of hours.
      const payload = {
        userId: values.userId,
        branchId: values.branchId,
        durationHours: values.durationHours,
        notes: values.notes || undefined,
      }

      const result = await apiPost<{ booking: { id: string }; tickets: Array<{ id: string }> }>('/bookings/admin/free-ticket', payload)

      // Get user name for success message
      const selectedUser = users?.find((u: any) => u.id === values.userId)
      const userName = selectedUser?.name || selectedUser?.email || 'العميل'

      message.success({
        content: `تم إنشاء ${result.tickets?.length || 1} تذكرة مجانية بنجاح للعميل: ${userName}`,
        duration: 5,
      })
      navigate(`/admin/bookings/${result.booking?.id}`)
    } catch (error: any) {
      console.error('Failed to create free ticket:', error)
      message.error(error?.message || 'فشل في إنشاء التذكرة المجانية')
    } finally {
      setLoading(false)
    }
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
                onClick={() => navigate('/admin/bookings')}
                size="large"
              />
              <h1 className="page-title" style={{ margin: 0 }}>
                إنشاء تذكرة مجانية
              </h1>
            </Space>
            <p className="page-subtitle">
              إنشاء تذكرة مجانية للعميل بدون دفع
            </p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <Card className="custom-card">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                durationHours: 2,
              }}
            >
              <Row gutter={[24, 0]}>
                {/* User Selection */}
                <Col xs={24} md={12}>
                  <Form.Item
                    name="userId"
                    label={
                      <span>
                        العميل <span style={{ color: '#ff4d4f' }}>*</span>
                        <span style={{ fontSize: '12px', color: '#8c8c8c', marginLeft: '8px' }}>
                          (التذكرة ستكون موجهة لهذا العميل)
                        </span>
                      </span>
                    }
                    rules={[{ required: true, message: 'يرجى اختيار العميل الذي ستوجه له التذكرة' }]}
                  >
                    <Select
                      showSearch
                      placeholder="اختر العميل الذي ستوجه له التذكرة المجانية"
                      options={userOptions}
                      loading={usersLoading}
                      filterOption={false}
                      onSearch={setUserSearch}
                      notFoundContent={
                        usersLoading
                          ? 'جاري التحميل...'
                          : userSearch
                            ? 'لا يوجد عملاء مطابقون'
                            : 'ابحث بالاسم أو البريد الإلكتروني'
                      }
                    />
                  </Form.Item>
                </Col>

                {/* Branch Selection */}
                <Col xs={24} md={12}>
                  <Form.Item
                    name="branchId"
                    label="الفرع"
                    rules={[{ required: true, message: 'يرجى اختيار الفرع' }]}
                  >
                    <Select
                      showSearch
                      placeholder="اختر الفرع"
                      options={branchOptions}
                      loading={branchesLoading}
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                      notFoundContent={branchesLoading ? 'جاري التحميل...' : 'لا يوجد فروع'}
                    />
                  </Form.Item>
                </Col>

                {/* Duration */}
                <Col xs={24} md={12}>
                  <Form.Item
                    name="durationHours"
                    label="المدة (بالساعات)"
                    rules={[
                      { required: true, message: 'يرجى إدخال المدة' },
                      { type: 'number', min: 1, max: 12, message: 'المدة يجب أن تكون بين 1 و 12 ساعة' },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      max={12}
                      placeholder="عدد الساعات"
                      addonAfter="ساعة"
                    />
                  </Form.Item>
                </Col>

                {/* Notes */}
                <Col xs={24}>
                  <Form.Item
                    name="notes"
                    label="ملاحظات (اختياري)"
                  >
                    <TextArea
                      rows={4}
                      placeholder="أضف ملاحظات أو طلبات خاصة..."
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: '24px', marginBottom: 0 }}>
                <Space>
                  <Button onClick={() => navigate('/admin/bookings')}>
                    إلغاء
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<SaveOutlined />}
                    size="large"
                  >
                    إنشاء التذكرة المجانية
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
