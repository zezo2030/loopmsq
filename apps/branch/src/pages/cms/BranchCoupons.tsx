import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, message } from 'antd'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'
import { useBranchAuth } from '../../auth'
import { useTranslation } from 'react-i18next'

type Coupon = {
  id: string
  branchId: string | null
  hallId?: string | null
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  startsAt?: string | null
  endsAt?: string | null
  isActive: boolean
}

export default function BranchCoupons() {
  const qc = useQueryClient()
  const { me } = useBranchAuth()
  const { t } = useTranslation()
  const branchId = me?.branchId

  const { data, isLoading } = useQuery<Coupon[]>({
    queryKey: ['branch:coupons'],
    queryFn: () => apiGet('/admin/coupons'),
    enabled: !!me,
  })

  const [hallsOptions, setHallsOptions] = useState<any[]>([])
  const [loadingHalls, setLoadingHalls] = useState(false)
  const [open, setOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [form] = Form.useForm()
  const [previewForm] = Form.useForm()

  const createMutation = useMutation({
    mutationFn: (body: Partial<Coupon>) => apiPost<Coupon>('/admin/coupons', body),
    onSuccess: () => { message.success(t('coupons.created')); qc.invalidateQueries({ queryKey: ['branch:coupons'] }); setOpen(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Coupon> }) => apiPatch(`/admin/coupons/${id}`, body),
    onSuccess: () => { message.success(t('coupons.updated')); qc.invalidateQueries({ queryKey: ['branch:coupons'] }); setOpen(false); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/coupons/${id}`),
    onSuccess: () => { message.success(t('coupons.deleted')); qc.invalidateQueries({ queryKey: ['branch:coupons'] }) },
  })

  const previewMutation = useMutation({
    mutationFn: (body: { code: string; amount: number }) => apiPost('/coupons/preview', body),
    onSuccess: (res: any) => {
      if (res.valid) message.success(t('coupons.valid', { finalAmount: res.finalAmount }))
      else message.error(t('coupons.invalid', { reason: res.reason }))
    }
  })

  useEffect(() => {
    if (!open || !branchId) return
    const load = async () => {
      setLoadingHalls(true)
      try {
        const halls = await apiGet<any[]>(`/content/halls?branchId=${branchId}`)
        setHallsOptions(halls || [])
      } catch (e) {
        message.error(t('halls.load_failed') || 'Failed to load halls')
        setHallsOptions([])
      } finally {
        setLoadingHalls(false)
      }
    }
    load()
  }, [open, branchId])

  const columns = [
    { title: t('coupons.hall'), dataIndex: 'hallId', render: (v: string) => v ? (hallsOptions.find(h => h.id === v)?.name_en || v) : t('coupons.all_halls') },
    { title: t('coupons.code'), dataIndex: 'code' },
    { title: t('coupons.discount_type'), dataIndex: 'discountType' },
    { title: t('coupons.discount_value'), dataIndex: 'discountValue' },
    { title: t('coupons.active'), dataIndex: 'isActive', render: (v: boolean) => (v ? t('common.yes') : t('common.no')) },
    { title: t('coupons.schedule'), render: (_: any, r: Coupon) => `${r.startsAt ?? '-'} → ${r.endsAt ?? '-'}` },
    { title: t('common.actions'), render: (_: any, r: Coupon) => (
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }}>{t('common.edit')}</Button>
        <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>{t('common.delete')}</Button>
      </span>
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Button onClick={() => { setPreviewOpen(true); previewForm.resetFields() }}>{t('coupons.preview')}</Button>
        </Space>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setHallsOptions([]); setOpen(true) }}>{t('coupons.new')}</Button>
      </div>

      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? t('coupons.edit') : t('coupons.create')}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null); setHallsOptions([]); form.resetFields() }}
        onOk={() => {
          form.validateFields().then(values => {
            const body: any = {
              branchId: branchId,
              hallId: values.hallId || null,
              code: values.code,
              discountType: values.discountType,
              discountValue: Number(values.discountValue),
              isActive: values.isActive ?? true,
            }
            const [start, end] = values.range || []
            body.startsAt = start ? start.toISOString() : null
            body.endsAt = end ? end.toISOString() : null
            if (editing) updateMutation.mutate({ id: editing.id, body })
            else createMutation.mutate(body)
          })
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ discountType: 'percentage', isActive: true }}>
          <Form.Item name="hallId" label={t('coupons.hall')}>
            <Select
              allowClear
              placeholder={t('coupons.all_halls')}
              loading={loadingHalls}
              disabled={loadingHalls || !branchId}
              options={(hallsOptions || []).map(h => ({ value: h.id, label: h.name_en }))}
            />
          </Form.Item>
          <Form.Item name="code" label={t('coupons.code')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="discountType" label={t('coupons.discount_type')} rules={[{ required: true }]}>
            <Select options={[{ value: 'percentage', label: t('coupons.percentage') }, { value: 'fixed', label: t('coupons.fixed') }]} />
          </Form.Item>
          <Form.Item name="discountValue" label={t('coupons.discount_value')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="range" label={t('coupons.schedule')}>
            <DatePicker.RangePicker showTime />
          </Form.Item>
          <Form.Item name="isActive" label={t('coupons.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('coupons.preview_title')}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        onOk={() => {
          previewForm.validateFields().then(values => {
            previewMutation.mutate({ code: values.code, amount: Number(values.amount) })
          })
        }}
      >
        <Form form={previewForm} layout="vertical">
          <Form.Item name="code" label={t('coupons.preview_code')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="amount" label={t('coupons.preview_amount')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}




