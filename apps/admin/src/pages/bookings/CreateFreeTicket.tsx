import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Space,
  message,
  Row,
  Col,
  TimePicker,
  Alert,
  Spin,
} from 'antd'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  TeamOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { apiGet, apiPost } from '../../api'
import { useQuery } from '@tanstack/react-query'
import '../../theme.css'
import dayjs from 'dayjs'

const { TextArea } = Input

type TimeSlot = {
  start: string
  end: string
  available: boolean
  consecutiveSlots: number
}

export default function CreateFreeTicket() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  
  // Watch form values for slots fetching
  const selectedDate = Form.useWatch('date', form)
  const selectedHallId = Form.useWatch('hallId', form)
  const selectedDuration = Form.useWatch('durationHours', form) || 2
  const selectedPersons = Form.useWatch('persons', form) || 1

  // Load users (clients only - filter to get only users with 'user' role)
  const { data: users, isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['users', 'clients'],
    queryFn: async () => {
      const res = await apiGet<{ users: any[] }>('/users?page=1&limit=1000')
      const allUsers = Array.isArray(res) ? res : (res.users || [])
      // Filter to get only clients (users with role 'user' or 'USER')
      return allUsers.filter((user: any) => {
        const roles = user.roles || []
        return roles.includes('user') || roles.includes('USER')
      })
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

  // Load halls based on selected branch
  const selectedBranchId = Form.useWatch('branchId', form)
  const { data: halls, isLoading: hallsLoading } = useQuery<any[]>({
    queryKey: ['halls', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return []
      const res = await apiGet<any>(`/content/halls?branchId=${selectedBranchId}`)
      return Array.isArray(res) ? res : (res.items || res.halls || [])
    },
    enabled: !!selectedBranchId,
  })

  // Load available time slots for selected hall, date, and duration
  const { data: slotsData, isLoading: slotsLoading } = useQuery<{ slots: TimeSlot[]; slotMinutes: number }>({
    queryKey: ['hall-slots', selectedHallId, selectedDate?.format('YYYY-MM-DD'), selectedDuration, selectedPersons],
    queryFn: async () => {
      if (!selectedHallId || !selectedDate) return { slots: [], slotMinutes: 60 }
      const dateStr = selectedDate.format('YYYY-MM-DD')
      const res = await apiGet<{ slots: TimeSlot[]; slotMinutes: number }>(
        `/content/halls/${selectedHallId}/slots?date=${dateStr}&durationHours=${selectedDuration}&persons=${selectedPersons}`
      )
      return res
    },
    enabled: !!selectedHallId && !!selectedDate,
  })

  const availableSlots = slotsData?.slots?.filter(slot => slot.available) || []

  const userOptions = (users || []).map((u: any) => ({
    label: `${u.name || u.email || 'غير محدد'} ${u.phone ? `(${u.phone})` : ''}`,
    value: u.id,
  }))

  const branchOptions = (branches || []).map((b: any) => ({
    label: `${b?.name_ar || b?.name_en || b?.name || ''} ${b?.location ? `- ${b.location}` : ''}`,
    value: b.id,
  }))

  const hallOptions = (halls || []).map((h: any) => ({
    label: `${h?.name_ar || h?.name_en || h?.name || ''} (سعة: ${h?.capacity || 0})`,
    value: h.id,
  }))

  async function handleSubmit(values: any) {
    setLoading(true)
    try {
      // Validate that time slot is available
      if (!values.date || !values.hallId || !values.time) {
        message.error('يرجى اختيار التاريخ والقاعة والوقت')
        setLoading(false)
        return
      }

      // Combine date and time
      const date = dayjs(values.date)
      const timeStr = values.time // Format: "HH:mm"
      const [hours, minutes] = timeStr.split(':').map(Number)
      
      const startTime = date
        .hour(hours)
        .minute(minutes)
        .second(0)
        .millisecond(0)
        .toISOString()
      
      // Verify slot is still available
      const selectedDateTime = date.hour(hours).minute(minutes).second(0).millisecond(0)
      const isSlotAvailable = availableSlots.some(slot => {
        const slotStart = dayjs(slot.start)
        return slotStart.isSame(selectedDateTime, 'minute')
      })
      
      if (!isSlotAvailable) {
        message.error('الوقت المحدد لم يعد متاحاً. يرجى اختيار وقت آخر.')
        setLoading(false)
        return
      }

      const payload = {
        userId: values.userId,
        branchId: values.branchId,
        hallId: values.hallId,
        startTime: startTime,
        durationHours: values.durationHours,
        persons: values.persons,
        notes: values.notes || undefined,
      }

      const result = await apiPost<{ booking: { id: string }; tickets: Array<{ id: string }> }>('/bookings/admin/free-ticket', payload)
      
      // Get user name for success message
      const selectedUser = users?.find((u: any) => u.id === values.userId)
      const userName = selectedUser?.name || selectedUser?.email || 'العميل'
      
      message.success({
        content: `تم إنشاء ${result.tickets?.length || values.persons} تذكرة مجانية بنجاح للعميل: ${userName}`,
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
                persons: 1,
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
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                      notFoundContent={usersLoading ? 'جاري التحميل...' : 'لا يوجد عملاء'}
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

                {/* Hall Selection */}
                <Col xs={24} md={12}>
                  <Form.Item
                    name="hallId"
                    label={
                      <span>
                        القاعة <span style={{ color: '#ff4d4f' }}>*</span>
                      </span>
                    }
                    rules={[{ required: true, message: 'يرجى اختيار القاعة' }]}
                  >
                    <Select
                      showSearch
                      placeholder="اختر القاعة"
                      options={hallOptions}
                      loading={hallsLoading}
                      disabled={!selectedBranchId}
                      filterOption={(input, option) =>
                        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                      }
                      notFoundContent={
                        !selectedBranchId
                          ? 'يرجى اختيار الفرع أولاً'
                          : hallsLoading
                          ? 'جاري التحميل...'
                          : 'لا يوجد قاعات'
                      }
                      onChange={() => {
                        // Reset date and time when hall changes
                        form.setFieldValue('date', undefined)
                        form.setFieldValue('time', undefined)
                      }}
                    />
                  </Form.Item>
                </Col>

                {/* Date */}
                <Col xs={24} md={12}>
                  <Form.Item
                    name="date"
                    label="التاريخ"
                    rules={[{ required: true, message: 'يرجى اختيار التاريخ' }]}
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      format="YYYY-MM-DD"
                      disabledDate={(current) => current && current < dayjs().startOf('day')}
                      placeholder="اختر التاريخ"
                      onChange={() => {
                        // Reset time when date changes to reload slots
                        form.setFieldValue('time', undefined)
                      }}
                    />
                  </Form.Item>
                </Col>

                {/* Time - Available Slots */}
                <Col xs={24} md={12}>
                  <Form.Item
                    name="time"
                    label="الوقت"
                    rules={[
                      { required: true, message: 'يرجى اختيار الوقت' },
                      {
                        validator: (_, value) => {
                          if (!value) {
                            return Promise.reject(new Error('يرجى اختيار الوقت'))
                          }
                          if (!selectedDate || !selectedHallId) {
                            return Promise.reject(new Error('يرجى اختيار التاريخ والقاعة أولاً'))
                          }
                          
                          // value is in format "HH:mm"
                          const [hours, minutes] = value.split(':').map(Number)
                          const selectedDateTime = selectedDate
                            .hour(hours)
                            .minute(minutes)
                            .second(0)
                            .millisecond(0)
                          
                          const isAvailable = availableSlots.some(slot => {
                            const slotStart = dayjs(slot.start)
                            return slotStart.isSame(selectedDateTime, 'minute')
                          })
                          
                          if (!isAvailable) {
                            return Promise.reject(new Error('هذا الوقت غير متاح، يرجى اختيار وقت من القائمة'))
                          }
                          
                          return Promise.resolve()
                        },
                      },
                    ]}
                  >
                    {selectedDate && selectedHallId ? (
                      <Select
                        placeholder={slotsLoading ? 'جاري تحميل الأوقات المتاحة...' : 'اختر الوقت المتاح'}
                        loading={slotsLoading}
                        disabled={slotsLoading || availableSlots.length === 0}
                        notFoundContent={
                          slotsLoading ? (
                            <Spin size="small" />
                          ) : availableSlots.length === 0 ? (
                            <span>لا توجد أوقات متاحة في هذا التاريخ</span>
                          ) : (
                            'لا توجد أوقات متاحة'
                          )
                        }
                      >
                        {availableSlots.map((slot, index) => {
                          const slotStart = dayjs(slot.start)
                          const slotEnd = dayjs(slot.end)
                          const maxHours = Math.floor((slot.consecutiveSlots * (slotsData?.slotMinutes || 60)) / 60)
                          
                          return (
                            <Select.Option
                              key={index}
                              value={slotStart.format('HH:mm')}
                              disabled={!slot.available}
                            >
                              <Space>
                                <ClockCircleOutlined />
                                <span>
                                  {slotStart.format('HH:mm')} - {slotEnd.format('HH:mm')}
                                </span>
                                {maxHours > 0 && (
                                  <span style={{ color: '#8c8c8c', fontSize: '12px' }}>
                                    (متاح حتى {maxHours} ساعة)
                                  </span>
                                )}
                              </Space>
                            </Select.Option>
                          )
                        })}
                      </Select>
                    ) : (
                      <TimePicker
                        style={{ width: '100%' }}
                        format="HH:mm"
                        placeholder="اختر التاريخ والقاعة أولاً"
                        disabled
                      />
                    )}
                  </Form.Item>
                  {selectedDate && selectedHallId && availableSlots.length === 0 && !slotsLoading && (
                    <Alert
                      message="لا توجد أوقات متاحة"
                      description="لا توجد فتحات متاحة للقاعة المحددة في هذا التاريخ. يرجى اختيار تاريخ آخر."
                      type="warning"
                      showIcon
                      style={{ marginTop: '8px' }}
                    />
                  )}
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
                      onChange={() => {
                        // Reset time when duration changes to reload slots
                        form.setFieldValue('time', undefined)
                      }}
                    />
                  </Form.Item>
                </Col>

                {/* Number of Persons */}
                <Col xs={24} md={12}>
                  <Form.Item
                    name="persons"
                    label="عدد الأشخاص"
                    rules={[
                      { required: true, message: 'يرجى إدخال عدد الأشخاص' },
                      { type: 'number', min: 1, message: 'يجب أن يكون العدد على الأقل 1' },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      placeholder="عدد الأشخاص"
                      addonAfter={<TeamOutlined />}
                      onChange={() => {
                        // Reset time when persons count changes to reload slots
                        form.setFieldValue('time', undefined)
                      }}
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

