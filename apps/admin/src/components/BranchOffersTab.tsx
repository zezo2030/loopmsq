import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, message, Upload, Image, Space } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { resolveFileUrl } from '../shared/url'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../api'
import dayjs from 'dayjs'

type Offer = {
  id: string
  branchId: string
  title: string
  description?: string | null
  discountType: 'percentage' | 'fixed'
  discountValue: number
  startsAt?: string | null
  endsAt?: string | null
  isActive: boolean
  imageUrl?: string | null
}

type BranchOffersTabProps = {
  branchId: string
}

export default function BranchOffersTab({ branchId }: BranchOffersTabProps) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Offer[]>({ 
    queryKey: ['offers', branchId], 
    queryFn: () => apiGet(`/admin/offers?branchId=${branchId}`) 
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Offer | null>(null)
  const [form] = Form.useForm()

  const createMutation = useMutation({
    mutationFn: (body: Partial<Offer>) => apiPost<Offer>('/admin/offers', { ...body, branchId }),
    onSuccess: () => { message.success('Offer created'); qc.invalidateQueries({ queryKey: ['offers'] }); setOpen(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Offer> }) => apiPatch(`/admin/offers/${id}`, { ...body, branchId }),
    onSuccess: () => { message.success('Offer updated'); qc.invalidateQueries({ queryKey: ['offers'] }); setOpen(false); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/offers/${id}`),
    onSuccess: () => { message.success('Offer removed'); qc.invalidateQueries({ queryKey: ['offers'] }) },
  })

  const columns = [
    { title: 'Branch', dataIndex: 'branchId', render: (v: string) => v || 'All Branches' },
    { title: 'Title', dataIndex: 'title' },
    { title: 'Image', dataIndex: 'imageUrl', render: (v: string) => v ? <Image src={resolveFileUrl(v)} width={80} height={50} style={{ objectFit: 'cover' }} /> : '-' },
    { title: 'Type', dataIndex: 'discountType' },
    { title: 'Value', dataIndex: 'discountValue' },
    { title: 'Active', dataIndex: 'isActive', render: (v: boolean) => (v ? 'Yes' : 'No') },
    { title: 'Schedule', render: (_: any, r: Offer) => `${r.startsAt ?? '-'} → ${r.endsAt ?? '-'}` },
    { title: 'Actions', render: (_: any, r: Offer) => (
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => { 
          setEditing(r); 
          form.setFieldsValue({
            ...r,
            range: [r.startsAt ? dayjs(r.startsAt) : null, r.endsAt ? dayjs(r.endsAt) : null]
          }); 
          setOpen(true) 
        }}>Edit</Button>
        <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>Delete</Button>
      </span>
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>New Offer</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? 'Edit Offer' : 'Create Offer'}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null) }}
        onOk={() => {
          form.validateFields().then(values => {
            const body: any = {
              branchId: branchId,
              title: values.title,
              description: values.description || null,
              discountType: values.discountType,
              discountValue: Number(values.discountValue),
              isActive: values.isActive ?? true,
              imageUrl: values.imageUrl || null,
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
          {/* Branch is automatically set from props */}
          <Form.Item name="branchId" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Image">
            <Space direction="vertical" style={{ width: '100%' }}>
              {form.getFieldValue('imageUrl') ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Image src={resolveFileUrl(form.getFieldValue('imageUrl'))} width={200} height={120} style={{ objectFit: 'cover', borderRadius: 8 }} />
                </div>
              ) : null}
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  const fd = new FormData()
                  fd.append('file', file)
                  apiPost<{ imageUrl: string }>('/admin/offers/upload', fd)
                    .then((res) => {
                      form.setFieldsValue({ imageUrl: res.imageUrl })
                      message.success('Image uploaded')
                    })
                    .catch(() => message.error('Upload failed'))
                  return false
                }}
              >
                <Button icon={<UploadOutlined />}>Upload Image</Button>
              </Upload>
              <Form.Item name="imageUrl" hidden> 
                <Input />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
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
    </div>
  )
}

