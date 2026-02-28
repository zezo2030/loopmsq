import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, message } from 'antd'
import { useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'
import dayjs from 'dayjs'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/auth'
import { useTranslation } from 'react-i18next'

type Coupon = {
  id: string
  branchId: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  startsAt?: string | null
  endsAt?: string | null
  isActive: boolean
}

export default function Coupons() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const location = useLocation()
  const { me } = useAuth()
  const isBranchMode = useMemo(() => location.pathname.startsWith('/branch'), [location.pathname])
  const enforcedBranchId = isBranchMode ? (me?.branchId || undefined) : undefined
  const [branchFilter, setBranchFilter] = useState<string | undefined>(enforcedBranchId)
  const { data, isLoading } = useQuery<Coupon[]>({ queryKey: ['coupons', branchFilter, isBranchMode], queryFn: () => apiGet(`/admin/coupons${(branchFilter || enforcedBranchId) ? `?branchId=${branchFilter || enforcedBranchId}` : ''}`) })
  const { data: branches } = useQuery<any[]>({ queryKey: ['branches:min'], queryFn: async () => {
    const res = await apiGet<any>('/content/branches?includeInactive=true')
    return Array.isArray(res) ? res : (res.items || res.branches || [])
  }})
  const [open, setOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [form] = Form.useForm()
  const [previewForm] = Form.useForm()

  const createMutation = useMutation({
    mutationFn: (body: Partial<Coupon>) => apiPost<Coupon>('/admin/coupons', body),
    onSuccess: () => { message.success(t('coupons.created')); qc.invalidateQueries({ queryKey: ['coupons'] }); setOpen(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Coupon> }) => apiPatch(`/admin/coupons/${id}`, body),
    onSuccess: () => { message.success(t('coupons.updated')); qc.invalidateQueries({ queryKey: ['coupons'] }); setOpen(false); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/coupons/${id}`),
    onSuccess: () => { message.success(t('coupons.removed')); qc.invalidateQueries({ queryKey: ['coupons'] }) },
  })

  const previewMutation = useMutation({
    mutationFn: (body: { code: string; amount: number }) => apiPost('/coupons/preview', body),
    onSuccess: (res: any) => {
      if (res.valid) message.success(t('coupons.valid', { amount: res.finalAmount }))
      else message.error(t('coupons.invalid', { reason: res.reason }))
    }
  })

  const columns = [
    { title: t('coupons.branch'), dataIndex: 'branchId', render: (v: string) => branches?.find(b => b.id === v)?.name_en || v },
    { title: t('coupons.code'), dataIndex: 'code' },
    { title: t('coupons.type'), dataIndex: 'discountType' },
    { title: t('coupons.value'), dataIndex: 'discountValue' },
    { title: t('coupons.active'), dataIndex: 'isActive', render: (v: boolean) => (v ? t('coupons.yes') : t('coupons.no')) },
    { title: t('coupons.schedule'), render: (_: any, r: Coupon) => `${r.startsAt ?? '-'} → ${r.endsAt ?? '-'}` },
    { title: t('coupons.actions'), render: (_: any, r: Coupon) => (
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue({
          ...r,
          range: [r.startsAt ? dayjs(r.startsAt) : null, r.endsAt ? dayjs(r.endsAt) : null]
        }); setOpen(true) }}>{t('coupons.edit')}</Button>
        <Button size="small" onClick={() => { setPreviewOpen(true); previewForm.setFieldsValue({ code: r.code }) }}>{t('coupons.preview')}</Button>
        <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>{t('coupons.delete')}</Button>
      </span>
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        {!isBranchMode && (
          <Select
            allowClear
            placeholder={t('coupons.filter_by_branch')}
            style={{ width: 240 }}
            value={branchFilter}
            onChange={(v) => setBranchFilter(v)}
            options={(branches || []).map(b => ({ value: b.id, label: b.name_en }))}
          />
        )}
        <Button onClick={() => { setPreviewOpen(true); previewForm.resetFields() }}>{t('coupons.preview_any_code')}</Button>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>{t('coupons.new_coupon')}</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? t('coupons.edit_coupon') : t('coupons.create_coupon')}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null) }}
        onOk={() => {
          form.validateFields().then(values => {
            const body: any = {
              branchId: enforcedBranchId || values.branchId,
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
          {!isBranchMode && (
            <Form.Item name="branchId" label={t('coupons.branch')} rules={[{ required: true }]}> 
              <Select
                placeholder={t('coupons.select_branch')}
                options={(branches || []).map(b => ({ value: b.id, label: b.name_en }))}
                onChange={() => {
                  // Branch is set, backend will handle the rest
                }}
              />
            </Form.Item>
          )}
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
        title={t('coupons.preview_discount')}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        onOk={() => {
          previewForm.validateFields().then(values => {
            previewMutation.mutate({ code: values.code, amount: Number(values.amount) })
          })
        }}
      >
        <Form form={previewForm} layout="vertical">
          <Form.Item name="code" label={t('coupons.code')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="amount" label={t('coupons.amount')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


