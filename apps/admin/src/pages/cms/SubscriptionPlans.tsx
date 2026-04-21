import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Table,
  message,
  Space,
  Upload,
  Image,
} from 'antd'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'
import { resolveFileUrl } from '../../shared/url'
import dayjs from 'dayjs'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/auth'
import { useTranslation } from 'react-i18next'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'

type SubscriptionPlan = {
  id: string
  branchId: string
  branchName?: string
  title: string
  description?: string | null
  imageUrl?: string | null
  termsAndConditions?: string | null
  price: number
  currency: string
  usageMode: 'flexible_total_hours' | 'daily_limited' | 'daily_unlimited'
  totalHours?: number | null
  dailyHoursLimit?: number | null
  mealItems?: string[] | null
  durationType: 'monthly' | 'quarterly' | 'yearly' | 'custom_months'
  durationMonths: number
  isGiftable: boolean
  isActive: boolean
  startsAt?: string | null
  endsAt?: string | null
  createdAt: string
}

type CreateSubscriptionPlanDto = {
  branchId: string
  title: string
  description?: string
  imageUrl?: string
  termsAndConditions?: string
  price: number
  currency?: string
  usageMode: 'flexible_total_hours' | 'daily_limited' | 'daily_unlimited'
  totalHours?: number | null
  dailyHoursLimit?: number | null
  mealItems?: string[]
  durationType: 'monthly' | 'quarterly' | 'yearly' | 'custom_months'
  durationMonths: number
  isGiftable?: boolean
  startsAt?: string | null
  endsAt?: string | null
}

const DURATION_TYPE_DEFAULTS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
}

export default function SubscriptionPlans() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const location = useLocation()
  const { me } = useAuth()
  const isBranchMode = location.pathname.startsWith('/branch')
  const enforcedBranchId = isBranchMode ? (me?.branchId || undefined) : undefined
  const [branchFilter, setBranchFilter] = useState<string | undefined>(enforcedBranchId)
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-plans', branchFilter, activeFilter],
    queryFn: () => {
      let url = '/admin/subscription-plans?'
      if (branchFilter || enforcedBranchId) url += `branchId=${branchFilter || enforcedBranchId}&`
      if (activeFilter !== undefined) url += `isActive=${activeFilter}&`
      return apiGet<{ plans: SubscriptionPlan[]; total: number; page: number; limit: number }>(url)
    },
  })

  const { data: branches } = useQuery<any[]>({
    queryKey: ['branches:min'],
    queryFn: async () => {
      const res = await apiGet<any>('/content/branches?includeInactive=true')
      return Array.isArray(res) ? res : (res.items || res.branches || [])
    },
  })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null)
  const [form] = Form.useForm()
  const durationType = Form.useWatch('durationType', form)
  const usageMode = Form.useWatch('usageMode', form)

  const handleCoverImageUpload: UploadProps['beforeUpload'] = async (file) => {
    if (!editing?.id) {
      message.error(t('subscriptionPlans.save_first') || 'Save the plan first before uploading an image')
      return Upload.LIST_IGNORE
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const updated = await apiPost<SubscriptionPlan>(
        `/admin/subscription-plans/${editing.id}/upload-cover`,
        formData
      )
      message.success(t('subscriptionPlans.image_uploaded') || 'Image uploaded successfully')
      setEditing((prev) => prev ? { ...prev, imageUrl: updated.imageUrl || prev.imageUrl } : prev)
      qc.invalidateQueries({ queryKey: ['subscription-plans'] })
    } catch (error) {
      message.error(t('subscriptionPlans.image_upload_failed') || 'Failed to upload image')
    }

    return false
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateSubscriptionPlanDto) =>
      apiPost<SubscriptionPlan>('/admin/subscription-plans', body),
    onSuccess: () => {
      message.success(t('subscriptionPlans.created'))
      qc.invalidateQueries({ queryKey: ['subscription-plans'] })
      setOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CreateSubscriptionPlanDto> }) =>
      apiPatch<SubscriptionPlan>(`/admin/subscription-plans/${id}`, body),
    onSuccess: () => {
      message.success(t('subscriptionPlans.updated'))
      qc.invalidateQueries({ queryKey: ['subscription-plans'] })
      setOpen(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/subscription-plans/${id}`),
    onSuccess: () => {
      message.success(t('subscriptionPlans.deactivated'))
      qc.invalidateQueries({ queryKey: ['subscription-plans'] })
    },
  })

  const getBranchName = (branchId: string) => {
    return branches?.find((b: any) => b.id === branchId)?.name_en || branchId
  }

  const formatDurationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      monthly: t('subscriptionPlans.monthly'),
      quarterly: t('subscriptionPlans.quarterly'),
      yearly: t('subscriptionPlans.yearly'),
      custom_months: t('subscriptionPlans.custom'),
    }
    return labels[type] || type
  }

  const formatUsageModeLabel = (type: string) => {
    const labels: Record<string, string> = {
      flexible_total_hours: t('subscriptionPlans.usage_flexible'),
      daily_limited: t('subscriptionPlans.usage_daily_limited'),
      daily_unlimited: t('subscriptionPlans.usage_daily_unlimited'),
    }
    return labels[type] || type
  }

  const formatHours = (value?: number | null) =>
    value == null ? (t('subscriptionPlans.unlimited') || 'Unlimited') : t('subscriptionPlans.hours_value', { hours: value })

  const columns = [
    ...(!isBranchMode
      ? [
          {
            title: t('subscriptionPlans.branch'),
            dataIndex: 'branchId',
            render: (v: string) => getBranchName(v),
          },
        ]
      : []),
    {
      title: t('subscriptionPlans.cover_image'),
      dataIndex: 'imageUrl',
      render: (v: string | null | undefined) =>
        v ? (
          <Image
            src={resolveFileUrl(v)}
            alt="Cover"
            style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4 }}
            preview
          />
        ) : (
          <span style={{ color: '#999', fontSize: 12 }}>No image</span>
        ),
    },
    { title: t('subscriptionPlans.title'), dataIndex: 'title' },
    {
      title: t('subscriptionPlans.price'),
      dataIndex: 'price',
      render: (v: number, r: SubscriptionPlan) => `${v} ${r.currency || 'SAR'}`,
    },
    {
      title: t('subscriptionPlans.usage_mode'),
      dataIndex: 'usageMode',
      render: (v: string) => formatUsageModeLabel(v),
    },
    {
      title: t('subscriptionPlans.total_hours'),
      dataIndex: 'totalHours',
      render: (v: number | null | undefined) => formatHours(v),
    },
    {
      title: t('subscriptionPlans.daily_limit'),
      dataIndex: 'dailyHoursLimit',
      render: (v: number | null | undefined) => formatHours(v),
    },
    {
      title: t('subscriptionPlans.duration'),
      render: (_: unknown, r: SubscriptionPlan) =>
        `${formatDurationTypeLabel(r.durationType)} (${r.durationMonths} ${t('subscriptionPlans.months')})`,
    },
    {
      title: t('subscriptionPlans.meals'),
      render: (_: unknown, r: SubscriptionPlan) =>
        r.mealItems?.length ? r.mealItems.join(' + ') : t('subscriptionPlans.no_meals'),
    },
    {
      title: t('subscriptionPlans.giftable'),
      dataIndex: 'isGiftable',
      render: (v: boolean) => (v ? t('subscriptionPlans.yes') : t('subscriptionPlans.no')),
    },
    {
      title: t('subscriptionPlans.active'),
      dataIndex: 'isActive',
      render: (v: boolean) => (v ? t('subscriptionPlans.yes') : t('subscriptionPlans.no')),
    },
    {
      title: t('subscriptionPlans.schedule'),
      render: (_: any, r: SubscriptionPlan) =>
        `${r.startsAt ? dayjs(r.startsAt).format('YYYY-MM-DD') : '-'} → ${
          r.endsAt ? dayjs(r.endsAt).format('YYYY-MM-DD') : '-'
        }`,
    },
    {
      title: t('subscriptionPlans.actions'),
      render: (_: any, r: SubscriptionPlan) => (
        <span style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            onClick={() => {
              setEditing(r)
              form.setFieldsValue({
                ...r,
                mealItems: r.mealItems || [],
                range: [r.startsAt ? dayjs(r.startsAt) : null, r.endsAt ? dayjs(r.endsAt) : null],
              })
              setOpen(true)
            }}
          >
            {t('subscriptionPlans.edit')}
          </Button>
          <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>
            {t('subscriptionPlans.deactivate')}
          </Button>
        </span>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          {!isBranchMode && (
            <Select
              allowClear
              placeholder={t('subscriptionPlans.filter_by_branch')}
              style={{ width: 240 }}
              value={branchFilter}
              onChange={(v) => setBranchFilter(v)}
              options={(branches || []).map((b: any) => ({ value: b.id, label: b.name_en }))}
            />
          )}
          <Select
            allowClear
            placeholder={t('subscriptionPlans.filter_by_active')}
            style={{ width: 120 }}
            value={activeFilter}
            onChange={(v) => setActiveFilter(v)}
            options={[
              { value: true, label: t('subscriptionPlans.active') },
              { value: false, label: t('subscriptionPlans.inactive') },
            ]}
          />
        </Space>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null)
            form.resetFields()
            form.setFieldsValue({
              usageMode: 'flexible_total_hours',
              durationType: 'monthly',
              durationMonths: 1,
              isGiftable: false,
              isActive: true,
              currency: 'SAR',
            })
            setOpen(true)
          }}
        >
          {t('subscriptionPlans.new_plan')}
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.plans || []}
        columns={columns as any}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editing ? t('subscriptionPlans.edit_plan') : t('subscriptionPlans.create_plan')}
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={() => {
          form.validateFields().then((values) => {
            const [start, end] = values.range || []
            const body: CreateSubscriptionPlanDto = {
              branchId: enforcedBranchId || values.branchId,
              title: values.title,
              description: values.description || undefined,
              imageUrl: values.imageUrl || undefined,
              termsAndConditions: values.termsAndConditions || undefined,
              price: Number(values.price),
              currency: values.currency || 'SAR',
              usageMode: values.usageMode,
              totalHours: values.usageMode === 'flexible_total_hours'
                ? Number(values.totalHours)
                : undefined,
              dailyHoursLimit: values.usageMode === 'daily_limited'
                ? Number(values.dailyHoursLimit)
                : undefined,
              mealItems: values.mealItems?.filter((item: string) => item?.trim()),
              durationType: values.durationType,
              durationMonths: Number(values.durationMonths),
              isGiftable: values.isGiftable ?? false,
              startsAt: start ? start.toISOString() : undefined,
              endsAt: end ? end.toISOString() : undefined,
            }

            if (editing) {
              updateMutation.mutate({ id: editing.id, body })
            } else {
              createMutation.mutate(body)
            }
          })
        }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            usageMode: 'flexible_total_hours',
            durationType: 'monthly',
            durationMonths: 1,
            isGiftable: false,
            isActive: true,
            currency: 'SAR',
          }}
        >
          {!isBranchMode && (
            <Form.Item name="branchId" label={t('subscriptionPlans.branch')} rules={[{ required: true }]}>
              <Select
                placeholder={t('subscriptionPlans.select_branch')}
                options={(branches || []).map((b: any) => ({ value: b.id, label: b.name_en }))}
              />
            </Form.Item>
          )}
          <Form.Item name="title" label={t('subscriptionPlans.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('subscriptionPlans.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="termsAndConditions"
            label={t('subscriptionPlans.terms') || 'Terms and Conditions'}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label={t('subscriptionPlans.cover_image')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {editing?.imageUrl ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Image
                    src={resolveFileUrl(editing.imageUrl)}
                    alt="Cover"
                    style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 8 }}
                  />
                </div>
              ) : (
                <Upload
                  disabled={!editing?.id}
                  beforeUpload={handleCoverImageUpload}
                  showUploadList={false}
                  accept="image/*"
                >
                  <Button icon={<UploadOutlined />} disabled={!editing?.id}>
                    {t('subscriptionPlans.upload_cover') || 'Upload Cover Image'}
                  </Button>
                </Upload>
              )}
              {!editing?.id && (
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  {t('subscriptionPlans.save_first') || 'Save the plan first before uploading an image'}
                </div>
              )}
            </Space>
          </Form.Item>
          <Form.Item name="price" label={t('subscriptionPlans.price')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item
            name="usageMode"
            label={t('subscriptionPlans.usage_mode')}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'flexible_total_hours', label: t('subscriptionPlans.usage_flexible') },
                { value: 'daily_limited', label: t('subscriptionPlans.usage_daily_limited') },
                { value: 'daily_unlimited', label: t('subscriptionPlans.usage_daily_unlimited') },
              ]}
            />
          </Form.Item>
          {usageMode === 'flexible_total_hours' && (
          <Form.Item
            name="totalHours"
            label={t('subscriptionPlans.total_hours')}
            rules={[{ required: true }]}
          >
            <InputNumber style={{ width: '100%' }} min={0.5} step={0.5} precision={1} />
          </Form.Item>
          )}
          {usageMode === 'daily_limited' && (
          <Form.Item
            name="dailyHoursLimit"
            label={t('subscriptionPlans.daily_limit')}
            rules={[{ required: true }]}
          >
            <InputNumber style={{ width: '100%' }} min={0.5} step={0.5} precision={1} />
          </Form.Item>
          )}
          {usageMode === 'daily_unlimited' && (
            <div style={{ marginBottom: 16, color: '#6b7280' }}>
              {t('subscriptionPlans.unlimited_daily_hint')}
            </div>
          )}
          <Form.Item name="mealItems" label={t('subscriptionPlans.meals')}>
            <Select
              mode="tags"
              tokenSeparators={[',']}
              placeholder={t('subscriptionPlans.meals_placeholder')}
              open={false}
            />
          </Form.Item>
          <Form.Item
            name="isGiftable"
            label={t('subscriptionPlans.giftable')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="durationType"
            label={t('subscriptionPlans.duration_type')}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'monthly', label: t('subscriptionPlans.monthly') },
                { value: 'quarterly', label: t('subscriptionPlans.quarterly') },
                { value: 'yearly', label: t('subscriptionPlans.yearly') },
                { value: 'custom_months', label: t('subscriptionPlans.custom') },
              ]}
              onChange={(value) => {
                if (value !== 'custom_months' && DURATION_TYPE_DEFAULTS[value]) {
                  form.setFieldsValue({ durationMonths: DURATION_TYPE_DEFAULTS[value] })
                }
              }}
            />
          </Form.Item>
          <Form.Item
            name="durationMonths"
            label={t('subscriptionPlans.duration_months')}
            rules={[{ required: true }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              precision={0}
              disabled={durationType !== 'custom_months'}
            />
          </Form.Item>
          <Form.Item name="range" label={t('subscriptionPlans.schedule')}>
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item name="isActive" label={t('subscriptionPlans.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
