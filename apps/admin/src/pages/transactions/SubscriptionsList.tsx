import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  CalendarOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  EditOutlined,
  FieldTimeOutlined,
  GiftOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { apiGet, apiPatch, apiPost } from '../../api'
import { resolveFileUrl } from '../../shared/url'

const PAYMENT_STATUS_OPTIONS = [
  { value: 'completed', label: 'مدفوع' },
  { value: 'pending', label: 'بانتظار الدفع' },
  { value: 'failed', label: 'فشل الدفع' },
]

const { RangePicker } = DatePicker
const { Text, Title } = Typography

type SubscriptionRow = {
  id: string
  status: 'active' | 'depleted' | 'expired' | 'cancelled'
  paymentStatus: 'pending' | 'completed' | 'failed'
  totalHours: number | null
  remainingHours: number | null
  dailyHoursLimit: number | null
  startedAt: string
  endsAt: string
  createdAt: string
  updatedAt: string
  user: { id: string; name: string; phone: string; email: string }
  branch: { id: string; name: string }
  plan: {
    id: string
    title: string
    usageMode: string
    durationMonths: number | null
    price: number
    currency: string
    imageUrl: string | null
  }
}

type ResponseShape = {
  subscriptions: SubscriptionRow[]
  stats: {
    total: number
    active: number
    expired: number
    depleted: number
    paid: number
    revenue: number
  }
  total: number
}

export default function SubscriptionsList() {
  const [rows, setRows] = useState<SubscriptionRow[]>([])
  const [stats, setStats] = useState<ResponseShape['stats']>({
    total: 0,
    active: 0,
    expired: 0,
    depleted: 0,
    paid: 0,
    revenue: 0,
  })
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<string | undefined>()
  const [paymentStatus, setPaymentStatus] = useState<string | undefined>()
  const [branchId, setBranchId] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<any>(null)
  const [payModalRow, setPayModalRow] = useState<SubscriptionRow | null>(null)
  const [payModalStatus, setPayModalStatus] = useState<string | undefined>()
  const [savingPayStatus, setSavingPayStatus] = useState(false)
  const [freeOpen, setFreeOpen] = useState(false)
  const [creatingFree, setCreatingFree] = useState(false)
  const [freeForm] = Form.useForm()
  const freeBranchId = Form.useWatch('branchId', freeForm)
  const holderImageUrl = Form.useWatch('holderImageUrl', freeForm)
  const [uploadingHolderImage, setUploadingHolderImage] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('')
  const [userOptions, setUserOptions] = useState<Array<{ label: string; value: string }>>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [planOptions, setPlanOptions] = useState<Array<{ label: string; value: string }>>([])
  const navigate = useNavigate()

  const openPaymentModal = (row: SubscriptionRow) => {
    setPayModalRow(row)
    setPayModalStatus(row.paymentStatus)
  }

  const submitPaymentStatus = async () => {
    if (!payModalRow || !payModalStatus) return
    setSavingPayStatus(true)
    try {
      await apiPatch(
        `/subscription-purchases/admin/all/${payModalRow.id}/payment-status`,
        { paymentStatus: payModalStatus },
      )
      message.success('تم تحديث حالة الدفع')
      setPayModalRow(null)
      await loadRows()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`تعذر تحديث حالة الدفع${detail ? `: ${detail}` : ''}`)
    } finally {
      setSavingPayStatus(false)
    }
  }

  const formatCurrency = (value: number, currency = 'SAR') =>
    `${new Intl.NumberFormat('ar-SA').format(value || 0)} ${currency}`

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString('ar-SA') : '-'

  const loadPlans = async (branch?: string) => {
    if (!branch) {
      setPlanOptions([])
      return
    }
    try {
      const res = await apiGet<any>(
        `/admin/subscription-plans?isActive=true&branchId=${branch}`,
      )
      const list = Array.isArray(res) ? res : (res?.plans || [])
      setPlanOptions(
        list.map((plan: any) => ({
          value: plan.id,
          label: `${plan.title} — ${formatCurrency(Number(plan.price || 0), plan.currency)}`,
        })),
      )
    } catch {
      setPlanOptions([])
    }
  }

  const onFreeBranchChange = (branch: string) => {
    freeForm.setFieldsValue({ subscriptionPlanId: undefined })
    setPlanOptions([])
    loadPlans(branch)
  }

  const loadUsers = async (q: string) => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', limit: '50', role: 'user' })
      if (q) params.set('q', q)
      const res = await apiGet<any>(`/users?${params.toString()}`)
      const list = Array.isArray(res) ? res : (res?.users || [])
      setUserOptions(
        list.map((u: any) => ({
          value: u.id,
          label: `${u.name || u.email || 'مستخدم'}${u.phone ? ` (${u.phone})` : ''}`,
        })),
      )
    } catch {
      setUserOptions([])
    } finally {
      setUsersLoading(false)
    }
  }

  const openFreeModal = () => {
    freeForm.resetFields()
    setUserSearch('')
    setUserOptions([])
    setPlanOptions([])
    setFreeOpen(true)
    loadUsers('')
  }

  const uploadHolderImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('يجب أن يكون الملف صورة')
      return
    }
    setUploadingHolderImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiPost<{ imageUrl: string }>(
        '/subscription-purchases/upload-holder-photo',
        fd,
      )
      freeForm.setFieldsValue({ holderImageUrl: res.imageUrl })
      message.success('تم رفع صورة الحامل')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`تعذر رفع الصورة${detail ? `: ${detail}` : ''}`)
    } finally {
      setUploadingHolderImage(false)
    }
  }

  const submitFree = async () => {
    let values: any
    try {
      values = await freeForm.validateFields()
    } catch {
      return
    }
    setCreatingFree(true)
    try {
      await apiPost('/subscription-purchases/admin/free', {
        userId: values.userId,
        subscriptionPlanId: values.subscriptionPlanId,
        holderName: values.holderName?.trim(),
        holderImageUrl: values.holderImageUrl?.trim() || undefined,
        note: values.note?.trim() || undefined,
      })
      message.success('تم إنشاء اشتراك مجاني وتفعيله للعميل')
      setFreeOpen(false)
      freeForm.resetFields()
      await loadRows()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`تعذر إنشاء الاشتراك المجاني${detail ? `: ${detail}` : ''}`)
    } finally {
      setCreatingFree(false)
    }
  }

  const loadBranches = async () => {
    try {
      const resp = await apiGet<any>('/content/branches?includeInactive=true')
      const list = Array.isArray(resp) ? resp : (resp?.items || resp?.branches || [])
      setBranches(
        list.map((branch: any) => ({
          id: branch.id,
          name: branch.name_ar || branch.name_en || 'فرع',
        })),
      )
    } catch {
      setBranches([])
    }
  }

  const loadRows = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', limit: '100' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status) params.set('status', status)
      if (paymentStatus) params.set('paymentStatus', paymentStatus)
      if (branchId) params.set('branchId', branchId)
      if (dateRange?.[0] && dateRange?.[1]) {
        params.set('from', dayjs(dateRange[0]).startOf('day').toISOString())
        params.set('to', dayjs(dateRange[1]).endOf('day').toISOString())
      }

      const data = await apiGet<ResponseShape>(`/subscription-purchases/admin/all?${params.toString()}`)
      setRows(data.subscriptions || [])
      setStats(
        data.stats || {
          total: 0,
          active: 0,
          expired: 0,
          depleted: 0,
          paid: 0,
          revenue: 0,
        },
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`تعذر تحميل الاشتراكات${detail ? `: ${detail}` : ''}`)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBranches()
  }, [])

  useEffect(() => {
    const delay = search.trim() ? 400 : 0
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), delay)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    loadRows()
  }, [debouncedSearch, status, paymentStatus, branchId, dateRange])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedUserSearch(userSearch.trim()), 350)
    return () => window.clearTimeout(t)
  }, [userSearch])

  useEffect(() => {
    if (freeOpen) loadUsers(debouncedUserSearch)
  }, [debouncedUserSearch])

  const columns = useMemo(
    () => [
      {
        title: 'المشترك',
        key: 'user',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div style={{ fontWeight: 700 }}>{row.user.name || 'مستخدم'}</div>
            <Text type="secondary">{row.user.phone || row.user.email || '-'}</Text>
          </div>
        ),
      },
      {
        title: 'الفرع',
        dataIndex: ['branch', 'name'],
      },
      {
        title: 'الخطة',
        key: 'plan',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div style={{ fontWeight: 700 }}>{row.plan.title}</div>
            <Text type="secondary">
              {formatCurrency(row.plan.price, row.plan.currency)}
            </Text>
          </div>
        ),
      },
      {
        title: 'الساعات',
        key: 'hours',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div>المتبقي: {row.remainingHours ?? 'غير محدود'}</div>
            <Text type="secondary">الإجمالي: {row.totalHours ?? 'غير محدود'}</Text>
          </div>
        ),
      },
      {
        title: 'الحالة',
        key: 'status',
        render: (_: unknown, row: SubscriptionRow) => (
          <Space direction="vertical" size={4}>
            <Tag color={row.status === 'active' ? 'green' : row.status === 'expired' ? 'orange' : row.status === 'depleted' ? 'red' : 'default'}>
              {row.status === 'active' && 'نشط'}
              {row.status === 'expired' && 'منتهي'}
              {row.status === 'depleted' && 'مستهلك'}
              {row.status === 'cancelled' && 'ملغي'}
            </Tag>
            <Tag color={row.paymentStatus === 'completed' ? 'blue' : row.paymentStatus === 'pending' ? 'gold' : 'red'}>
              {row.paymentStatus === 'completed' && 'مدفوع'}
              {row.paymentStatus === 'pending' && 'بانتظار الدفع'}
              {row.paymentStatus === 'failed' && 'فشل الدفع'}
            </Tag>
          </Space>
        ),
      },
      {
        title: 'فترة الاشتراك',
        key: 'period',
        render: (_: unknown, row: SubscriptionRow) => (
          <div>
            <div>{formatDate(row.startedAt)}</div>
            <Text type="secondary">حتى {formatDate(row.endsAt)}</Text>
          </div>
        ),
      },
      {
        title: 'التفاصيل',
        key: 'actions',
        render: (_: unknown, row: SubscriptionRow) => (
          <Space direction="vertical" size={4}>
            <a onClick={() => navigate(`/admin/finance/subscriptions/${row.id}`)}>عرض</a>
            <a onClick={() => openPaymentModal(row)}>
              <EditOutlined /> تغيير حالة الدفع
            </a>
          </Space>
        ),
      },
    ],
    [],
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <Title level={2} style={{ margin: 0 }}>الاشتراكات المشتراة</Title>
            <Text type="secondary">متابعة جميع اشتراكات العملاء عبر الفروع مع حالة الدفع والاستهلاك.</Text>
          </div>
          <Button type="primary" icon={<GiftOutlined />} onClick={openFreeModal}>
            إنشاء اشتراك مجاني
          </Button>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="إجمالي الاشتراكات" value={stats.total} prefix={<CalendarOutlined />} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="النشطة" value={stats.active} valueStyle={{ color: '#16a34a' }} prefix={<FieldTimeOutlined />} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="المنتهية" value={stats.expired} valueStyle={{ color: '#f59e0b' }} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="المستهلكة" value={stats.depleted} valueStyle={{ color: '#dc2626' }} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="المدفوعة" value={stats.paid} prefix={<CreditCardOutlined />} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={4}>
              <Card><Statistic title="الإيراد" value={stats.revenue} formatter={(v) => formatCurrency(Number(v || 0))} /></Card>
            </Col>
          </Row>

          <Card style={{ marginBottom: 24 }}>
            <Space wrap size="middle" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space wrap>
                <Input
                  allowClear
                  size="large"
                  style={{ width: 260 }}
                  placeholder="بحث بالعميل أو الفرع أو اسم الخطة"
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select
                  allowClear
                  size="large"
                  style={{ width: 180 }}
                  placeholder="حالة الاشتراك"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'active', label: 'نشط' },
                    { value: 'expired', label: 'منتهي' },
                    { value: 'depleted', label: 'مستهلك' },
                    { value: 'cancelled', label: 'ملغي' },
                  ]}
                />
                <Select
                  allowClear
                  size="large"
                  style={{ width: 180 }}
                  placeholder="حالة الدفع"
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                  options={PAYMENT_STATUS_OPTIONS}
                />
                <Select
                  allowClear
                  size="large"
                  style={{ width: 220 }}
                  placeholder="الفرع"
                  value={branchId}
                  onChange={setBranchId}
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
                <RangePicker size="large" onChange={setDateRange as any} />
              </Space>
              <a onClick={() => loadRows()}><ReloadOutlined /> تحديث</a>
            </Space>
          </Card>

          <Card>
            <Table<SubscriptionRow>
              rowKey="id"
              loading={loading}
              dataSource={rows}
              columns={columns as any}
              locale={{
                emptyText: <Empty description="لا توجد اشتراكات مطابقة" />,
              }}
              pagination={{ pageSize: 12, showSizeChanger: true }}
              scroll={{ x: 1100 }}
            />
          </Card>
        </div>
      </div>

      <Modal
        title="تغيير حالة الدفع يدويًا"
        open={!!payModalRow}
        onCancel={() => setPayModalRow(null)}
        onOk={submitPaymentStatus}
        okButtonProps={{ disabled: !payModalStatus, loading: savingPayStatus }}
        okText="حفظ"
        cancelText="إلغاء"
        destroyOnClose
      >
        {payModalRow && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">المشترك</Text>
              <div style={{ fontWeight: 700 }}>{payModalRow.user.name || 'مستخدم'}</div>
            </div>
            <div>
              <Text type="secondary">الخطة</Text>
              <div>{payModalRow.plan.title}</div>
            </div>
            <div>
              <Text type="secondary">حالة الدفع الجديدة</Text>
              <Select
                style={{ width: '100%', marginTop: 4 }}
                value={payModalStatus}
                onChange={setPayModalStatus}
                options={PAYMENT_STATUS_OPTIONS}
              />
            </div>
            {payModalStatus === 'completed' && (
              <Text type="warning">
                تعيين الحالة كمدفوع سيقوم بتفعيل الاشتراك وإصدار رمز الدخول للعميل.
              </Text>
            )}
            {payModalStatus === 'failed' && (
              <Text type="warning">
                تعيين الحالة كفشل الدفع سيقوم بإلغاء الاشتراك.
              </Text>
            )}
          </Space>
        )}
      </Modal>

      <Modal
        title="إنشاء اشتراك مجاني لعميل"
        open={freeOpen}
        onCancel={() => {
          setFreeOpen(false)
          freeForm.resetFields()
        }}
        onOk={submitFree}
        okButtonProps={{ loading: creatingFree }}
        okText="إنشاء وتفعيل"
        cancelText="إلغاء"
        destroyOnClose
      >
        <Form form={freeForm} layout="vertical">
          <Form.Item
            name="userId"
            label="العميل"
            rules={[{ required: true, message: 'يرجى اختيار العميل' }]}
          >
            <Select
              showSearch
              placeholder="ابحث بالاسم أو البريد أو الجوال"
              options={userOptions}
              loading={usersLoading}
              filterOption={false}
              onSearch={setUserSearch}
              notFoundContent={usersLoading ? 'جاري التحميل...' : 'لا يوجد عملاء مطابقون'}
            />
          </Form.Item>
          <Form.Item
            name="branchId"
            label="الفرع"
            rules={[{ required: true, message: 'يرجى اختيار الفرع' }]}
          >
            <Select
              showSearch
              placeholder="اختر الفرع"
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
              optionFilterProp="label"
              onChange={onFreeBranchChange}
            />
          </Form.Item>
          <Form.Item
            name="subscriptionPlanId"
            label="الباقة"
            rules={[{ required: true, message: 'يرجى اختيار الباقة' }]}
          >
            <Select
              showSearch
              disabled={!freeBranchId}
              placeholder={freeBranchId ? 'اختر الباقة' : 'اختر الفرع أولًا'}
              options={planOptions}
              optionFilterProp="label"
              notFoundContent="لا توجد باقات في هذا الفرع"
            />
          </Form.Item>
          <Form.Item
            name="holderName"
            label="اسم حامل الاشتراك"
            rules={[
              { required: true, message: 'يرجى إدخال اسم حامل الاشتراك' },
              { min: 2, max: 100, message: 'الاسم يجب أن يكون بين 2 و100 حرف' },
            ]}
          >
            <Input placeholder="مثال: عمر أحمد" />
          </Form.Item>
          <Form.Item label="صورة الحامل (اختياري)">
            <Space direction="vertical" style={{ width: '100%' }}>
              {holderImageUrl ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Image
                    src={resolveFileUrl(holderImageUrl)}
                    alt="صورة الحامل"
                    style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8 }}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => freeForm.setFieldsValue({ holderImageUrl: undefined })}
                    style={{ position: 'absolute', top: 4, right: 4 }}
                  />
                </div>
              ) : (
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    uploadHolderImage(file)
                    return false
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={uploadingHolderImage}>
                    {uploadingHolderImage ? 'جاري الرفع...' : 'رفع صورة الحامل'}
                  </Button>
                </Upload>
              )}
            </Space>
          </Form.Item>
          <Form.Item name="holderImageUrl" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="note" label="ملاحظة (اختياري)">
            <Input.TextArea
              rows={2}
              maxLength={500}
              placeholder="سبب منح الاشتراك المجاني"
            />
          </Form.Item>
          <Text type="secondary">
            سيتم إنشاء الاشتراك وتفعيله فورًا بدون أي دفع، مع إصدار رمز الدخول وإشعار العميل.
          </Text>
        </Form>
      </Modal>
    </div>
  )
}
