import { useMemo, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Space, message, Row, Col } from 'antd'
import { apiGet, apiPost, apiPut, apiPatch } from '../../api'
import { useSearchParams } from 'react-router-dom'
import { useAdminAuth } from '../../auth'

type Hall = {
  id: string
  branchId: string
  name_ar: string
  name_en: string
  priceConfig: {
    basePrice: number
    hourlyRate: number
    weekendMultiplier: number
    holidayMultiplier: number
    decorationPrice?: number
  }
  isDecorated: boolean
  capacity: number
  description_ar?: string | null
  description_en?: string | null
  features?: string[]
  images?: string[]
  status?: 'available' | 'maintenance' | 'reserved'
}

export default function Halls() {
  const { me } = useAdminAuth()
  const canEdit = (me?.roles || []).includes('admin')
  const canUpdateStatus = canEdit || (me?.roles || []).includes('branch_manager')
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Hall | null>(null)
  const [form] = Form.useForm()

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewForm] = Form.useForm()

  const [branchFilter, setBranchFilter] = useState<string | undefined>()
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [searchParams, setSearchParams] = useSearchParams()

  const queryKey = useMemo(() => ['halls', { branchFilter }], [branchFilter])
  const { data, isLoading, refetch } = useQuery<Hall[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (branchFilter) params.set('branchId', branchFilter)
      const res = await apiGet<any>(`/content/halls?${params.toString()}`)
      return Array.isArray(res) ? res : (res.items || res.halls || [])
    },
  })

  // Initialize from URL
  useEffect(() => {
    const bf = searchParams.get('branchId') || undefined
    const p = Number(searchParams.get('page') || '1')
    const ps = Number(searchParams.get('pageSize') || '10')
    setBranchFilter(bf)
    if (!Number.isNaN(p)) setPage(p)
    if (!Number.isNaN(ps)) setPageSize(ps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync to URL
  useEffect(() => {
    const next = new URLSearchParams()
    if (branchFilter) next.set('branchId', branchFilter)
    next.set('page', String(page))
    next.set('pageSize', String(pageSize))
    setSearchParams(next, { replace: true })
  }, [branchFilter, page, pageSize, setSearchParams])

  const createHall = useMutation({
    mutationFn: async (payload: Partial<Hall>) => apiPost('/content/halls', payload),
    onSuccess: () => { message.success('تم إنشاء القاعة'); qc.invalidateQueries({ queryKey: ['halls'] }); setOpen(false) },
  })
  const updateHall = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Hall> }) => apiPut(`/content/halls/${id}`, body),
    onSuccess: () => { message.success('تم تحديث القاعة'); qc.invalidateQueries({ queryKey: ['halls'] }); setOpen(false); setEditing(null) },
  })
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: NonNullable<Hall['status']> }) => apiPatch(`/content/halls/${id}/status`, { status }),
    onSuccess: () => { message.success('تم تحديث الحالة'); qc.invalidateQueries({ queryKey: ['halls'] }) },
  })

  const columns = [
    { title: 'الفرع', dataIndex: 'branchId', key: 'branchId' },
    { title: 'الاسم (AR)', dataIndex: 'name_ar', key: 'name_ar' },
    { title: 'الاسم (EN)', dataIndex: 'name_en', key: 'name_en' },
    { title: 'السعة', dataIndex: 'capacity', key: 'capacity' },
    { title: 'الحالة', dataIndex: 'status', key: 'status' },
    {
      title: 'التسعير',
      key: 'pricing',
      render: (_: any, r: Hall) => `${r.priceConfig.basePrice} + ${r.priceConfig.hourlyRate}/h`,
    },
    {
      title: 'إجراءات',
      key: 'actions',
      render: (_: any, r: Hall) => (
        <Space>
          <Button size="small" disabled={!canEdit} onClick={() => { setEditing(r); form.setFieldsValue({
            branchId: r.branchId,
            name_ar: r.name_ar,
            name_en: r.name_en,
            capacity: r.capacity,
            isDecorated: r.isDecorated,
            price_basePrice: r.priceConfig.basePrice,
            price_hourlyRate: r.priceConfig.hourlyRate,
            price_weekendMultiplier: r.priceConfig.weekendMultiplier,
            price_holidayMultiplier: r.priceConfig.holidayMultiplier,
            price_decorationPrice: r.priceConfig.decorationPrice,
            description_ar: r.description_ar,
            description_en: r.description_en,
            features: r.features,
            images: r.images,
          }); setOpen(true) }}>تعديل</Button>
          <Select
            value={r.status}
            style={{ width: 170 }}
            disabled={!canUpdateStatus}
            onChange={(v) => updateStatus.mutate({ id: r.id, status: v as any })}
            options={[
              { label: 'Available', value: 'available' },
              { label: 'Maintenance', value: 'maintenance' },
              { label: 'Reserved', value: 'reserved' },
            ]}
          />
          <Button size="small" onClick={() => { setPreviewOpen(true); previewForm.setFieldsValue({ hallId: r.id }) }}>معاينة السعر/التوفر</Button>
        </Space>
      ),
    },
  ]

  return (
    <Card title="القاعات" extra={
      <Space>
        <Input placeholder="تصفية بالفرع (UUID)" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value || undefined)} style={{ width: 260 }} />
        <Button onClick={() => refetch()}>تحديث</Button>
        <Button type="primary" disabled={!canEdit} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>قاعة جديدة</Button>
      </Space>
    }>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data || []}
        columns={columns as any}
        pagination={{ current: page, pageSize, onChange: (p, ps) => { setPage(p); setPageSize(ps) } }}
      />

      <Modal
        title={editing ? 'تعديل قاعة' : 'إنشاء قاعة'}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null) }}
        onOk={() => form.submit()}
        okText={editing ? 'تحديث' : 'إنشاء'}
        width={820}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            const body: any = {
              branchId: values.branchId,
              name_ar: values.name_ar,
              name_en: values.name_en,
              capacity: Number(values.capacity || 0),
              isDecorated: !!values.isDecorated,
              priceConfig: {
                basePrice: Number(values.price_basePrice || 0),
                hourlyRate: Number(values.price_hourlyRate || 0),
                weekendMultiplier: Number(values.price_weekendMultiplier || 1),
                holidayMultiplier: Number(values.price_holidayMultiplier || 1),
                decorationPrice: values.price_decorationPrice != null ? Number(values.price_decorationPrice) : undefined,
              },
              description_ar: values.description_ar || null,
              description_en: values.description_en || null,
              features: values.features?.length ? values.features : undefined,
              images: values.images?.length ? values.images : undefined,
            }
            if (!canEdit) { message.error('غير مصرح'); return }
            if (editing) updateHall.mutate({ id: editing.id, body })
            else createHall.mutate(body)
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="branchId" label="معرف الفرع" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="capacity" label="السعة" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name_ar" label="الاسم (AR)" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name_en" label="الاسم (EN)" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="price_basePrice" label="Base">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="price_hourlyRate" label="Hourly">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="price_weekendMultiplier" label="Weekend x">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="price_holidayMultiplier" label="Holiday x">
                <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="price_decorationPrice" label="Decoration">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isDecorated" label="مزينة" valuePropName="checked">
                <Select
                  options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="features" label="المزايا">
            <Select mode="tags" placeholder="أدخل المزايا" />
          </Form.Item>
          <Form.Item name="images" label="صور (روابط)">
            <Select mode="tags" placeholder="أدخل روابط الصور" />
          </Form.Item>
          <Form.Item name="description_ar" label="الوصف (AR)">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="description_en" label="الوصف (EN)">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="معاينة السعر والتوفر"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        onOk={() => previewForm.submit()}
      >
        <Form form={previewForm} layout="vertical" onFinish={async (values) => {
          try {
            const params = new URLSearchParams()
            params.set('startTime', values.startTime)
            params.set('durationHours', String(values.durationHours))
            params.set('persons', String(values.persons))
            const pricing = await apiGet<any>(`/content/halls/${values.hallId}/pricing?${params.toString()}`)
            const availParams = new URLSearchParams()
            availParams.set('startTime', values.startTime)
            availParams.set('durationHours', String(values.durationHours))
            const availability = await apiGet<any>(`/content/halls/${values.hallId}/availability?${availParams.toString()}`)
            message.success(`Total: ${pricing.total ?? JSON.stringify(pricing)} | Available: ${availability.available}`)
          } catch (e: any) {
            message.error(e?.message || 'فشل المعاينة')
          }
        }}>
          <Form.Item name="hallId" label="Hall" rules={[{ required: true }]}>
            <Select
              showSearch
              options={(data || []).map(h => ({ value: h.id, label: `${h.name_en} (${h.id.slice(0,8)}...)` }))}
              filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="startTime" label="Start Time (ISO)" rules={[{ required: true }]}>
            <Input placeholder="2025-10-14T18:00:00.000Z" />
          </Form.Item>
          <Form.Item name="durationHours" label="Duration (hours)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="persons" label="Persons" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}


