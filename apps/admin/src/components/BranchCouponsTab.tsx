import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, message } from 'antd'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../api'
import dayjs from 'dayjs'

type Coupon = {
  id: string
  branchId: string
  hallId?: string | null
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  startsAt?: string | null
  endsAt?: string | null
  isActive: boolean
}

type BranchCouponsTabProps = {
  branchId: string
}

export default function BranchCouponsTab({ branchId }: BranchCouponsTabProps) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Coupon[]>({ 
    queryKey: ['coupons', branchId], 
    queryFn: () => apiGet(`/admin/coupons?branchId=${branchId}`) 
  })
  const { data: halls } = useQuery<any[]>({ 
    queryKey: ['halls', branchId], 
    queryFn: () => apiGet(`/content/halls?branchId=${branchId}`) 
  })
  const [open, setOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [form] = Form.useForm()
  const [previewForm] = Form.useForm()

  const createMutation = useMutation({
    mutationFn: (body: Partial<Coupon>) => apiPost<Coupon>('/admin/coupons', { ...body, branchId }),
    onSuccess: () => { message.success('Coupon created'); qc.invalidateQueries({ queryKey: ['coupons'] }); setOpen(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Coupon> }) => apiPatch(`/admin/coupons/${id}`, { ...body, branchId }),
    onSuccess: () => { message.success('Coupon updated'); qc.invalidateQueries({ queryKey: ['coupons'] }); setOpen(false); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/coupons/${id}`),
    onSuccess: () => { message.success('Coupon removed'); qc.invalidateQueries({ queryKey: ['coupons'] }) },
  })

  const previewMutation = useMutation({
    mutationFn: (body: { code: string; amount: number }) => apiPost('/coupons/preview', body),
    onSuccess: (res: any) => {
      if (res.valid) message.success(`Valid. Final: ${res.finalAmount}`)
      else message.error(`Invalid: ${res.reason}`)
    }
  })

  const columns = [
    { title: 'Hall', dataIndex: 'hallId', render: (v: string) => v ? (halls?.find(h => h.id === v)?.name_en || v) : 'All Halls' },
    { title: 'Code', dataIndex: 'code' },
    { title: 'Type', dataIndex: 'discountType' },
    { title: 'Value', dataIndex: 'discountValue' },
    { title: 'Active', dataIndex: 'isActive', render: (v: boolean) => (v ? 'Yes' : 'No') },
    { title: 'Schedule', render: (_: any, r: Coupon) => `${r.startsAt ?? '-'} → ${r.endsAt ?? '-'}` },
    { title: 'Actions', render: (_: any, r: Coupon) => (
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => { 
          setEditing(r); 
          form.setFieldsValue({
            ...r,
            range: [r.startsAt ? dayjs(r.startsAt) : null, r.endsAt ? dayjs(r.endsAt) : null]
          }); 
          setOpen(true) 
        }}>Edit</Button>
        <Button size="small" onClick={() => { setPreviewOpen(true); previewForm.setFieldsValue({ code: r.code }) }}>Preview</Button>
        <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>Delete</Button>
      </span>
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Button onClick={() => { setPreviewOpen(true); previewForm.resetFields() }}>Preview Any Code</Button>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>New Coupon</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? 'Edit Coupon' : 'Create Coupon'}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null) }}
        onOk={() => {
          form.validateFields().then(values => {
            const body: any = {
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
          <Form.Item name="hallId" label="Hall (optional)">
            <Select
              allowClear
              placeholder="All Halls"
              options={(halls || []).map(h => ({ value: h.id, label: h.name_en }))}
            />
          </Form.Item>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="discountType" label="Discount Type" rules={[{ required: true }]}>
            <Select options={[{ value: 'percentage', label: 'Percentage %' }, { value: 'fixed', label: 'Fixed' }]} />
          </Form.Item>
          <Form.Item name="discountValue" label="Discount Value" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="range" label="Schedule">
            <DatePicker.RangePicker showTime />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Preview Discount"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        onOk={() => {
          previewForm.validateFields().then(values => {
            previewMutation.mutate({ code: values.code, amount: Number(values.amount) })
          })
        }}
      >
        <Form form={previewForm} layout="vertical">
          <Form.Item name="code" label="Code" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

