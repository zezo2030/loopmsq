import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, message } from 'antd'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'
import dayjs from 'dayjs'

type EventPackage = {
  id: string
  branchId: string
  eventType: string
  name: string
  description?: string | null
  basePrice: number
  pricePerPerson: number
  pricePerHour: number
  minPersons?: number | null
  maxPersons?: number | null
  minDuration?: number | null
  maxDuration?: number | null
  startsAt?: string | null
  endsAt?: string | null
  isActive: boolean
  items?: { name: string; price?: number; quantity?: number }[] | null
}

export default function Packages() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<EventPackage[]>({ queryKey: ['packages'], queryFn: () => apiGet('/admin/packages') })
  const [open, setOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editing, setEditing] = useState<EventPackage | null>(null)
  const [form] = Form.useForm()
  const [previewForm] = Form.useForm()

  const createMutation = useMutation({
    mutationFn: (body: Partial<EventPackage>) => apiPost<EventPackage>('/admin/packages', body),
    onSuccess: () => { message.success('Package created'); qc.invalidateQueries({ queryKey: ['packages'] }); setOpen(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<EventPackage> }) => apiPatch(`/admin/packages/${id}`, body),
    onSuccess: () => { message.success('Package updated'); qc.invalidateQueries({ queryKey: ['packages'] }); setOpen(false); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/packages/${id}`),
    onSuccess: () => { message.success('Package removed'); qc.invalidateQueries({ queryKey: ['packages'] }) },
  })
  const previewMutation = useMutation({
    mutationFn: (body: { packageId: string; persons: number; durationHours: number }) => apiPost('/admin/packages/preview', body),
    onSuccess: (res: any) => { if (res.valid) message.success(`Total: ${res.total}`); else message.error(res.reason) }
  })

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Event Type', dataIndex: 'eventType' },
    { title: 'Branch', dataIndex: 'branchId' },
    { title: 'Base', dataIndex: 'basePrice' },
    { title: 'Per Person', dataIndex: 'pricePerPerson' },
    { title: 'Per Hour', dataIndex: 'pricePerHour' },
    { title: 'Active', dataIndex: 'isActive', render: (v: boolean) => (v ? 'Yes' : 'No') },
    { title: 'Actions', render: (_: any, r: EventPackage) => (
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue({
          ...r,
          range: [r.startsAt ? dayjs(r.startsAt) : null, r.endsAt ? dayjs(r.endsAt) : null]
        }); setOpen(true) }}>Edit</Button>
        <Button size="small" onClick={() => { setPreviewOpen(true); previewForm.setFieldsValue({ packageId: r.id }) }}>Preview</Button>
        <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>Delete</Button>
      </span>
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>New Package</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? 'Edit Package' : 'Create Package'}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null) }}
        onOk={() => {
          form.validateFields().then(values => {
            const body: any = {
              branchId: values.branchId,
              eventType: values.eventType,
              name: values.name,
              description: values.description || null,
              basePrice: Number(values.basePrice || 0),
              pricePerPerson: Number(values.pricePerPerson || 0),
              pricePerHour: Number(values.pricePerHour || 0),
              minPersons: values.minPersons ?? null,
              maxPersons: values.maxPersons ?? null,
              minDuration: values.minDuration ?? null,
              maxDuration: values.maxDuration ?? null,
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
        <Form form={form} layout="vertical" initialValues={{ isActive: true }}>
          <Form.Item name="branchId" label="Branch ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="eventType" label="Event Type" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="basePrice" label="Base Price">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="pricePerPerson" label="Price Per Person">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="pricePerHour" label="Price Per Hour">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minPersons" label="Min Persons">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxPersons" label="Max Persons">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minDuration" label="Min Duration (hours)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxDuration" label="Max Duration (hours)">
            <InputNumber min={0} style={{ width: '100%' }} />
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
        title="Price Preview"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        onOk={() => {
          previewForm.validateFields().then(values => {
            previewMutation.mutate({ packageId: values.packageId, persons: Number(values.persons), durationHours: Number(values.durationHours) })
          })
        }}
      >
        <Form form={previewForm} layout="vertical">
          <Form.Item name="packageId" label="Package" rules={[{ required: true }]}>
            <Select
              options={(data || []).map(p => ({ value: p.id, label: `${p.name} (${p.eventType})` }))}
              showSearch
              filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="persons" label="Persons" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="durationHours" label="Duration (hours)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


