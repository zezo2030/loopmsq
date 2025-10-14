import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, Modal, Switch, Table, message } from 'antd'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'
import dayjs from 'dayjs'

type Banner = {
  id: string
  title: string
  imageUrl: string
  link?: string | null
  startsAt?: string | null
  endsAt?: string | null
  isActive: boolean
}

export default function Banners() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Banner[]>({ queryKey: ['banners'], queryFn: () => apiGet('/admin/banners') })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)
  const [form] = Form.useForm()

  const createMutation = useMutation({
    mutationFn: (body: Partial<Banner>) => apiPost<Banner>('/admin/banners', body),
    onSuccess: () => { message.success('Banner created'); qc.invalidateQueries({ queryKey: ['banners'] }); setOpen(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Banner> }) => apiPatch(`/admin/banners/${id}`, body),
    onSuccess: () => { message.success('Banner updated'); qc.invalidateQueries({ queryKey: ['banners'] }); setOpen(false); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/banners/${id}`),
    onSuccess: () => { message.success('Banner removed'); qc.invalidateQueries({ queryKey: ['banners'] }) },
  })

  const columns = [
    { title: 'Title', dataIndex: 'title' },
    { title: 'Image URL', dataIndex: 'imageUrl' },
    { title: 'Link', dataIndex: 'link' },
    { title: 'Active', dataIndex: 'isActive', render: (v: boolean) => (v ? 'Yes' : 'No') },
    { title: 'Schedule', render: (_: any, r: Banner) => `${r.startsAt ?? '-'} → ${r.endsAt ?? '-'}` },
    { title: 'Actions', render: (_: any, r: Banner) => (
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue({ ...r, range: [r.startsAt ? dayjs(r.startsAt) : null, r.endsAt ? dayjs(r.endsAt) : null] }); setOpen(true) }}>Edit</Button>
        <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>Delete</Button>
      </span>
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>New Banner</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? 'Edit Banner' : 'Create Banner'}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null) }}
        onOk={() => {
          form.validateFields().then(values => {
            const body: any = {
              title: values.title,
              imageUrl: values.imageUrl,
              link: values.link || null,
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
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="imageUrl" label="Image URL" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="link" label="Link">
            <Input />
          </Form.Item>
          <Form.Item name="range" label="Schedule">
            <DatePicker.RangePicker showTime />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


