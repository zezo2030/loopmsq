import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, message } from 'antd'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'
import { useBranchAuth } from '../../auth'

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
    onSuccess: () => { message.success('Coupon created'); qc.invalidateQueries({ queryKey: ['branch:coupons'] }); setOpen(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Coupon> }) => apiPatch(`/admin/coupons/${id}`, body),
    onSuccess: () => { message.success('Coupon updated'); qc.invalidateQueries({ queryKey: ['branch:coupons'] }); setOpen(false); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/coupons/${id}`),
    onSuccess: () => { message.success('Coupon removed'); qc.invalidateQueries({ queryKey: ['branch:coupons'] }) },
  })

  const previewMutation = useMutation({
    mutationFn: (body: { code: string; amount: number }) => apiPost('/coupons/preview', body),
    onSuccess: (res: any) => {
      if (res.valid) message.success(`Valid. Final: ${res.finalAmount}`)
      else message.error(`Invalid: ${res.reason}`)
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
        message.error('Failed to load halls')
        setHallsOptions([])
      } finally {
        setLoadingHalls(false)
      }
    }
    load()
  }, [open, branchId])

  const columns = [
    { title: 'Hall', dataIndex: 'hallId', render: (v: string) => v ? (hallsOptions.find(h => h.id === v)?.name_en || v) : 'All Halls' },
    { title: 'Code', dataIndex: 'code' },
    { title: 'Type', dataIndex: 'discountType' },
    { title: 'Value', dataIndex: 'discountValue' },
    { title: 'Active', dataIndex: 'isActive', render: (v: boolean) => (v ? 'Yes' : 'No') },
    { title: 'Schedule', render: (_: any, r: Coupon) => `${r.startsAt ?? '-'} → ${r.endsAt ?? '-'}` },
    { title: 'Actions', render: (_: any, r: Coupon) => (
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }}>Edit</Button>
        <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>Delete</Button>
      </span>
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Button onClick={() => { setPreviewOpen(true); previewForm.resetFields() }}>Preview Any Code</Button>
        </Space>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setHallsOptions([]); setOpen(true) }}>New Coupon</Button>
      </div>

      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? 'Edit Coupon' : 'Create Coupon'}
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
          <Form.Item name="hallId" label="Hall (optional)">
            <Select
              allowClear
              placeholder="All Halls"
              loading={loadingHalls}
              disabled={loadingHalls || !branchId}
              options={(hallsOptions || []).map(h => ({ value: h.id, label: h.name_en }))}
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




