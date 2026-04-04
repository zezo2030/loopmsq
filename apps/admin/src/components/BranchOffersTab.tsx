import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, message, Upload, Image, Space } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { resolveFileUrl } from '../shared/url'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../api'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

type Offer = {
  id: string
  branchId: string
  title: string
  description?: string | null
  discountType: 'percentage' | 'fixed' | 'bogo'
  discountValue: number
  buyCount?: number | null
  freeCount?: number | null
  startsAt?: string | null
  endsAt?: string | null
  isActive: boolean
  imageUrl?: string | null
}

type BranchOffersTabProps = {
  branchId: string
}

export default function BranchOffersTab({ branchId }: BranchOffersTabProps) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Offer[]>({ 
    queryKey: ['offers', branchId], 
    queryFn: () => apiGet(`/admin/offers?branchId=${branchId}`) 
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Offer | null>(null)
  const [form] = Form.useForm()
  const discountType = Form.useWatch('discountType', form)

  const createMutation = useMutation({
    mutationFn: (body: Partial<Offer>) => apiPost<Offer>('/admin/offers', { ...body, branchId }),
    onSuccess: () => { message.success(t('offers.created')); qc.invalidateQueries({ queryKey: ['offers'] }); setOpen(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Offer> }) => apiPatch(`/admin/offers/${id}`, { ...body, branchId }),
    onSuccess: () => { message.success(t('offers.updated')); qc.invalidateQueries({ queryKey: ['offers'] }); setOpen(false); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/offers/${id}`),
    onSuccess: () => { message.success(t('offers.removed')); qc.invalidateQueries({ queryKey: ['offers'] }) },
  })

  const formatTypeLabel = (dt: string) => {
    if (dt === 'bogo') return t('offers.bogo')
    if (dt === 'fixed') return t('offers.fixed')
    return t('offers.percentage')
  }

  const formatValueCell = (r: Offer) => {
    if (r.discountType === 'bogo') {
      const b = r.buyCount ?? 1
      const f = r.freeCount ?? 1
      return t('offers.bogo_summary', { buy: b, free: f })
    }
    return String(r.discountValue)
  }

  const columns = [
    { title: t('offers.branch'), dataIndex: 'branchId', render: (v: string) => v || t('offers.all_branches') },
    { title: t('offers.title'), dataIndex: 'title' },
    { title: t('offers.image'), dataIndex: 'imageUrl', render: (v: string) => v ? <Image src={resolveFileUrl(v)} width={80} height={50} style={{ objectFit: 'cover' }} /> : '-' },
    { title: t('offers.type'), dataIndex: 'discountType', render: (v: string) => formatTypeLabel(v) },
    { title: t('offers.value'), render: (_: unknown, r: Offer) => formatValueCell(r) },
    { title: t('offers.active'), dataIndex: 'isActive', render: (v: boolean) => (v ? t('offers.yes') : t('offers.no')) },
    { title: t('offers.schedule'), render: (_: any, r: Offer) => `${r.startsAt ?? '-'} → ${r.endsAt ?? '-'}` },
    { title: t('offers.actions'), render: (_: any, r: Offer) => (
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => { 
          setEditing(r); 
          form.setFieldsValue({
            ...r,
            buyCount: r.buyCount ?? 1,
            freeCount: r.freeCount ?? 1,
            range: [r.startsAt ? dayjs(r.startsAt) : null, r.endsAt ? dayjs(r.endsAt) : null]
          }); 
          setOpen(true) 
        }}>{t('offers.edit')}</Button>
        <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>{t('offers.delete')}</Button>
      </span>
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ discountType: 'percentage', isActive: true, buyCount: 1, freeCount: 1 }); setOpen(true) }}>{t('offers.new_offer')}</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? t('offers.edit_offer') : t('offers.create_offer')}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null) }}
        onOk={() => {
          form.validateFields().then(values => {
            const isBogo = values.discountType === 'bogo'
            const body: Record<string, unknown> = {
              branchId: branchId,
              title: values.title,
              description: values.description || null,
              discountType: values.discountType,
              discountValue: isBogo ? 0 : Number(values.discountValue),
              buyCount: isBogo ? Number(values.buyCount) : null,
              freeCount: isBogo ? Number(values.freeCount) : null,
              isActive: values.isActive ?? true,
              imageUrl: values.imageUrl || null,
            }
            const [start, end] = values.range || []
            body.startsAt = start ? start.toISOString() : null
            body.endsAt = end ? end.toISOString() : null
            if (editing) updateMutation.mutate({ id: editing.id, body: body as Partial<Offer> })
            else createMutation.mutate(body as Partial<Offer>)
          })
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ discountType: 'percentage', isActive: true, buyCount: 1, freeCount: 1 }}>
          {/* Branch is automatically set from props */}
          <Form.Item name="branchId" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="title" label={t('offers.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('offers.image')}>
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
                      message.success(t('offers.image_uploaded'))
                    })
                    .catch(() => message.error(t('offers.upload_failed')))
                  return false
                }}
              >
                <Button icon={<UploadOutlined />}>{t('offers.upload_image')}</Button>
              </Upload>
              <Form.Item name="imageUrl" hidden> 
                <Input />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="description" label={t('offers.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="discountType" label={t('offers.discount_type')} rules={[{ required: true }]}>
            <Select options={[
              { value: 'percentage', label: t('offers.percentage') },
              { value: 'fixed', label: t('offers.fixed') },
              { value: 'bogo', label: t('offers.bogo') },
            ]} />
          </Form.Item>
          {discountType === 'bogo' ? (
            <>
              <Form.Item name="buyCount" label={t('offers.buy_count')} rules={[{ required: true }, { type: 'number', min: 1 }]}>
                <InputNumber style={{ width: '100%' }} min={1} precision={0} />
              </Form.Item>
              <Form.Item name="freeCount" label={t('offers.free_count')} rules={[{ required: true }, { type: 'number', min: 1 }]}>
                <InputNumber style={{ width: '100%' }} min={1} precision={0} />
              </Form.Item>
            </>
          ) : (
            <Form.Item name="discountValue" label={t('offers.discount_value')} rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          )}
          <Form.Item name="range" label={t('offers.schedule')}>
            <DatePicker.RangePicker showTime />
          </Form.Item>
          <Form.Item name="isActive" label={t('offers.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
