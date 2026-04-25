import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, Tag, message, Upload, Image, Space } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { resolveFileUrlWithBust } from '../../shared/url'
import { useState, useMemo } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'
import dayjs from 'dayjs'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/auth'
import { useTranslation } from 'react-i18next'

type OfferProduct = {
  id: string
  branchId: string
  branchName?: string
  title: string
  description?: string | null
  imageUrl?: string | null
  termsAndConditions?: string | null
  offerCategory: 'hour_based'
  price: number
  currency: string
  isActive: boolean
  startsAt?: string | null
  endsAt?: string | null
  canRepeatInSameOrder: boolean
  isGiftable: boolean
  includedAddOns?: { addonId: string; name: string; price?: number; quantity: number }[] | null
  ticketConfig?: { paidTicketCount: number; freeTicketCount: number; totalGeneratedCount: number } | null
  hoursConfig?: { durationHours: number; bonusHours?: number; isOpenTime?: boolean } | null
  createdAt: string
}

type CreateOfferProductDto = {
  branchId: string
  title: string
  description?: string
  imageUrl?: string
  termsAndConditions?: string
  offerCategory: 'hour_based'
  price: number
  currency?: string
  canRepeatInSameOrder?: boolean
  isGiftable?: boolean
  includedAddOns?: { addonId: string; quantity: number }[]
  hoursConfig?: { durationHours: number; bonusHours?: number; isOpenTime?: boolean }
  startsAt?: string | null
  endsAt?: string | null
}

export default function OfferProducts() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const location = useLocation()
  const { me } = useAuth()
  const isBranchMode = useMemo(() => location.pathname.startsWith('/branch'), [location.pathname])
  const enforcedBranchId = isBranchMode ? (me?.branchId || undefined) : undefined
  const [branchFilter, setBranchFilter] = useState<string | undefined>(enforcedBranchId)
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey: ['offer-products', branchFilter, categoryFilter, activeFilter],
    queryFn: () => {
      let url = '/admin/offer-products?'
      if (branchFilter || enforcedBranchId) url += `branchId=${branchFilter || enforcedBranchId}&`
      if (categoryFilter) url += `category=${categoryFilter}&`
      if (activeFilter !== undefined) url += `isActive=${activeFilter}&`
      return apiGet<{ offers: OfferProduct[]; total: number; page: number; limit: number }>(url)
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
  const [editing, setEditing] = useState<OfferProduct | null>(null)
  const [form] = Form.useForm()
  const isOpenTime = Form.useWatch('isOpenTime', form)
  const selectedBranchId = Form.useWatch('branchId', form) || enforcedBranchId || branchFilter
  const { data: branchAddons } = useQuery<any[]>({
    queryKey: ['branch-addons-for-offers', selectedBranchId],
    enabled: !!selectedBranchId,
    queryFn: async () =>
      apiGet(`/content/branches/${selectedBranchId}/addons?scope=offer`),
  })
  const offerAddons = useMemo(
    () => (branchAddons || []).filter((addon: any) => (addon.category || 'general') === 'offer'),
    [branchAddons]
  )

  const createMutation = useMutation({
    mutationFn: (body: CreateOfferProductDto) => apiPost<OfferProduct>('/admin/offer-products', body),
    onSuccess: () => {
      message.success(t('offerProducts.created'))
      qc.invalidateQueries({ queryKey: ['offer-products'] })
      setOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CreateOfferProductDto> }) =>
      apiPatch<OfferProduct>(`/admin/offer-products/${id}`, body),
    onSuccess: () => {
      message.success(t('offerProducts.updated'))
      qc.invalidateQueries({ queryKey: ['offer-products'] })
      setOpen(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/offer-products/${id}`),
    onSuccess: () => {
      message.success(t('offerProducts.deactivated'))
      qc.invalidateQueries({ queryKey: ['offer-products'] })
    },
  })

  const getBranchName = (branchId: string) => {
    return branches?.find((b: any) => b.id === branchId)?.name_en || branchId
  }

  const formatCategoryLabel = () => t('offerProducts.hour_based')

  const getCategoryColor = () => 'green'

  const formatConfigCell = (r: OfferProduct) => {
    if (r.offerCategory === 'hour_based' && r.hoursConfig) {
      if (r.hoursConfig.isOpenTime) return 'الوقت المفتوح'
      if ((r.hoursConfig.bonusHours || 0) > 0) {
        return `${r.hoursConfig.durationHours} + ${r.hoursConfig.bonusHours} ساعات`
      }
      return t('offerProducts.hours_summary', { hours: r.hoursConfig.durationHours })
    }
    return '-'
  }

  const columns = [
    ...(!isBranchMode
      ? [
          {
            title: t('offerProducts.branch'),
            dataIndex: 'branchId',
            render: (v: string) => getBranchName(v),
          },
        ]
      : []),
    { title: t('offerProducts.title'), dataIndex: 'title' },
    {
      title: t('offerProducts.image'),
      dataIndex: 'imageUrl',
      render: (v: string) => (v ? <Image src={resolveFileUrlWithBust(v)} width={80} height={50} style={{ objectFit: 'cover' }} /> : '-'),
    },
    {
      title: t('offerProducts.category'),
      dataIndex: 'offerCategory',
      render: () => <Tag color={getCategoryColor()}>{formatCategoryLabel()}</Tag>,
    },
    {
      title: t('offerProducts.config'),
      render: (_: unknown, r: OfferProduct) => formatConfigCell(r),
    },
    {
      title: t('offerProducts.price'),
      dataIndex: 'price',
      render: (v: number, r: OfferProduct) => `${v} ${r.currency || 'SAR'}`,
    },
    {
      title: t('offerProducts.active'),
      dataIndex: 'isActive',
      render: (v: boolean) => (v ? t('offerProducts.yes') : t('offerProducts.no')),
    },
    {
      title: t('offerProducts.giftable'),
      dataIndex: 'isGiftable',
      render: (v: boolean) => (v ? t('offerProducts.yes') : t('offerProducts.no')),
    },
    {
      title: t('offerProducts.schedule'),
      render: (_: any, r: OfferProduct) => `${r.startsAt ? dayjs(r.startsAt).format('YYYY-MM-DD') : '-'} → ${r.endsAt ? dayjs(r.endsAt).format('YYYY-MM-DD') : '-'}`,
    },
    {
      title: t('offerProducts.actions'),
      render: (_: any, r: OfferProduct) => (
        <span style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            onClick={() => {
              setEditing(r)
              form.setFieldsValue({
                ...r,
                durationHours: r.hoursConfig?.durationHours ?? 1,
                bonusHours: r.hoursConfig?.bonusHours ?? 0,
                isOpenTime: r.hoursConfig?.isOpenTime ?? false,
                includedAddOns: (r.includedAddOns || []).map((item) => ({
                  addonId: item.addonId,
                  quantity: item.quantity,
                })),
                range: [r.startsAt ? dayjs(r.startsAt) : null, r.endsAt ? dayjs(r.endsAt) : null],
              })
              setOpen(true)
            }}
          >
            {t('offerProducts.edit')}
          </Button>
          <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>
            {t('offerProducts.deactivate')}
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
              placeholder={t('offerProducts.filter_by_branch')}
              style={{ width: 240 }}
              value={branchFilter}
              onChange={(v) => setBranchFilter(v)}
              options={(branches || []).map((b: any) => ({ value: b.id, label: b.name_en }))}
            />
          )}
          <Select
            allowClear
            placeholder={t('offerProducts.filter_by_category')}
            style={{ width: 160 }}
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(v)}
            options={[{ value: 'hour_based', label: t('offerProducts.hour_based') }]}
          />
          <Select
            allowClear
            placeholder={t('offerProducts.filter_by_active')}
            style={{ width: 120 }}
            value={activeFilter}
            onChange={(v) => setActiveFilter(v)}
            options={[
              { value: true, label: t('offerProducts.active') },
              { value: false, label: t('offerProducts.inactive') },
            ]}
          />
        </Space>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null)
            form.resetFields()
            form.setFieldsValue({ offerCategory: 'hour_based', isActive: true, canRepeatInSameOrder: true, isGiftable: false, isOpenTime: false, bonusHours: 0, durationHours: 1 })
            setOpen(true)
          }}
        >
          {t('offerProducts.new_offer')}
        </Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data?.offers || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? t('offerProducts.edit_offer') : t('offerProducts.create_offer')}
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={() => {
          form.validateFields().then((values) => {
            const [start, end] = values.range || []
            const body: CreateOfferProductDto = {
              branchId: enforcedBranchId || values.branchId,
              title: values.title,
              description: values.description || undefined,
              imageUrl: values.imageUrl || undefined,
              termsAndConditions: values.termsAndConditions || undefined,
              offerCategory: values.offerCategory,
              price: Number(values.price),
              currency: values.currency || 'SAR',
              canRepeatInSameOrder: values.canRepeatInSameOrder ?? true,
              isGiftable: values.isGiftable ?? false,
              includedAddOns: values.includedAddOns || undefined,
              startsAt: start ? start.toISOString() : undefined,
              endsAt: end ? end.toISOString() : undefined,
            }

            body.hoursConfig = {
              durationHours: Number(values.durationHours || 1),
              bonusHours: Number(values.bonusHours || 0),
              isOpenTime: values.isOpenTime === true,
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
          initialValues={{ offerCategory: 'hour_based', isActive: true, canRepeatInSameOrder: true, isGiftable: false, currency: 'SAR', isOpenTime: false, bonusHours: 0, durationHours: 1 }}
        >
          {!isBranchMode && (
            <Form.Item name="branchId" label={t('offerProducts.branch')} rules={[{ required: true }]}>
              <Select
                placeholder={t('offerProducts.select_branch')}
                options={(branches || []).map((b: any) => ({ value: b.id, label: b.name_en }))}
              />
            </Form.Item>
          )}
          <Form.Item name="title" label={t('offerProducts.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('offerProducts.image')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {form.getFieldValue('imageUrl') && (
                <Image src={resolveFileUrlWithBust(form.getFieldValue('imageUrl'))} width={200} height={120} style={{ objectFit: 'cover', borderRadius: 8 }} />
              )}
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  const fd = new FormData()
                  fd.append('file', file)
                  apiPost<{ imageUrl: string }>('/admin/offers/upload', fd)
                    .then((res) => {
                      form.setFieldsValue({ imageUrl: res.imageUrl })
                      message.success(t('offerProducts.image_uploaded'))
                    })
                    .catch(() => message.error(t('offerProducts.upload_failed')))
                  return false
                }}
              >
                <Button icon={<UploadOutlined />}>{t('offerProducts.upload_image')}</Button>
              </Upload>
              <Form.Item name="imageUrl" hidden>
                <Input />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="description" label={t('offerProducts.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="termsAndConditions"
            label={t('offerProducts.terms') || 'Terms and Conditions'}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="offerCategory" label={t('offerProducts.category')} hidden initialValue="hour_based">
            <Input />
          </Form.Item>
          <Form.Item name="price" label={t('offerProducts.price')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="canRepeatInSameOrder" label={t('offerProducts.can_repeat')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="isGiftable" label={t('offerProducts.giftable')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="durationHours" label={t('offerProducts.duration_hours')}>
            <InputNumber style={{ width: '100%' }} min={0.5} step={0.5} precision={1} disabled={isOpenTime === true} />
          </Form.Item>
          <Form.Item name="bonusHours" label="الساعات المجانية">
            <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={1} disabled={isOpenTime === true} />
          </Form.Item>
          <Form.Item name="isOpenTime" label="الوقت المفتوح" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.List name="includedAddOns">
            {(fields, { add, remove }) => (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <strong>إضافات العرض</strong>
                  <Button onClick={() => add({ quantity: 1 })}>إضافة عنصر</Button>
                </div>
                {fields.map((field) => (
                  <Space key={field.key} align="start" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item name={[field.name, 'addonId']} rules={[{ required: true, message: 'اختر الإضافة' }]}>
                      <Select
                        style={{ width: 240 }}
                        placeholder="اختر إضافة من الفرع"
                        options={offerAddons.map((addon: any) => ({
                          value: addon.id,
                          label: `${addon.name}${Number(addon.price || 0) > 0 ? ` - ${Number(addon.price).toFixed(2)} SAR` : ''}`,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item name={[field.name, 'quantity']} rules={[{ required: true, message: 'الكمية مطلوبة' }]}>
                      <InputNumber min={1} precision={0} placeholder="1" />
                    </Form.Item>
                    <Button danger onClick={() => remove(field.name)}>
                      حذف
                    </Button>
                  </Space>
                ))}
              </div>
            )}
          </Form.List>

          <Form.Item name="range" label={t('offerProducts.schedule')}>
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item name="isActive" label={t('offerProducts.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
