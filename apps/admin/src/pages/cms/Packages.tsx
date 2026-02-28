import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, message } from 'antd'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<EventPackage[]>({ queryKey: ['packages'], queryFn: () => apiGet('/admin/packages') })
  const [open, setOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editing, setEditing] = useState<EventPackage | null>(null)
  const [form] = Form.useForm()
  const [previewForm] = Form.useForm()

  const createMutation = useMutation({
    mutationFn: (body: Partial<EventPackage>) => apiPost<EventPackage>('/admin/packages', body),
    onSuccess: () => { message.success(t('packages.created')); qc.invalidateQueries({ queryKey: ['packages'] }); setOpen(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<EventPackage> }) => apiPatch(`/admin/packages/${id}`, body),
    onSuccess: () => { message.success(t('packages.updated')); qc.invalidateQueries({ queryKey: ['packages'] }); setOpen(false); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/packages/${id}`),
    onSuccess: () => { message.success(t('packages.removed')); qc.invalidateQueries({ queryKey: ['packages'] }) },
  })
  const previewMutation = useMutation({
    mutationFn: (body: { packageId: string; persons: number; durationHours: number }) => apiPost('/admin/packages/preview', body),
    onSuccess: (res: any) => { if (res.valid) message.success(t('packages.total', { amount: res.total })); else message.error(res.reason) }
  })

  const columns = [
    { title: t('packages.name'), dataIndex: 'name' },
    { title: t('packages.event_type'), dataIndex: 'eventType' },
    { title: t('packages.branch'), dataIndex: 'branchId' },
    { title: t('packages.base'), dataIndex: 'basePrice' },
    { title: t('packages.per_person'), dataIndex: 'pricePerPerson' },
    { title: t('packages.per_hour'), dataIndex: 'pricePerHour' },
    { title: t('packages.active'), dataIndex: 'isActive', render: (v: boolean) => (v ? t('packages.yes') : t('packages.no')) },
    { title: t('packages.actions'), render: (_: any, r: EventPackage) => (
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue({
          ...r,
          range: [r.startsAt ? dayjs(r.startsAt) : null, r.endsAt ? dayjs(r.endsAt) : null]
        }); setOpen(true) }}>{t('packages.edit')}</Button>
        <Button size="small" onClick={() => { setPreviewOpen(true); previewForm.setFieldsValue({ packageId: r.id }) }}>{t('packages.preview')}</Button>
        <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>{t('packages.delete')}</Button>
      </span>
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>{t('packages.new_package')}</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? t('packages.edit_package') : t('packages.create_package')}
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
          <Form.Item name="branchId" label={t('packages.branch_id')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="eventType" label={t('packages.event_type')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label={t('packages.name')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('packages.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="basePrice" label={t('packages.base_price')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="pricePerPerson" label={t('packages.price_per_person')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="pricePerHour" label={t('packages.price_per_hour')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minPersons" label={t('packages.min_persons')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxPersons" label={t('packages.max_persons')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minDuration" label={t('packages.min_duration')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxDuration" label={t('packages.max_duration')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="range" label={t('packages.schedule')}>
            <DatePicker.RangePicker showTime />
          </Form.Item>
          <Form.Item name="isActive" label={t('packages.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('packages.price_preview')}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        onOk={() => {
          previewForm.validateFields().then(values => {
            previewMutation.mutate({ packageId: values.packageId, persons: Number(values.persons), durationHours: Number(values.durationHours) })
          })
        }}
      >
        <Form form={previewForm} layout="vertical">
          <Form.Item name="packageId" label={t('packages.package')} rules={[{ required: true }]}>
            <Select
              options={(data || []).map(p => ({ value: p.id, label: `${p.name} (${p.eventType})` }))}
              showSearch
              filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="persons" label={t('packages.persons')} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="durationHours" label={t('packages.duration_hours')} rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


